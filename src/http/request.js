"use strict";

const net = require("net");
const tls = require("tls");
const { createCacheKey, getCachedResponse, storeCachedResponse } = require("./cache");
const { parseHttpResponse } = require("./response");

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);

function normalizeUrl(input) {
  const candidate = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https protocols are supported.");
  }

  return parsed;
}

function createRawGetRequest(urlObj, options = {}) {
  const path = `${urlObj.pathname || "/"}${urlObj.search || ""}`;
  const hostHeader = urlObj.port ? `${urlObj.hostname}:${urlObj.port}` : urlObj.hostname;
  const acceptHeader = options.acceptHeader || "text/html,application/json;q=0.9,*/*;q=0.8";

  return [
    `GET ${path} HTTP/1.1`,
    `Host: ${hostHeader}`,
    "User-Agent: go2web/0.1",
    "Connection: close",
    `Accept: ${acceptHeader}`,
    "",
    "",
  ].join("\r\n");
}

function makeSocketRequest(urlObj, timeoutMs = 15000, options = {}) {
  const isHttps = urlObj.protocol === "https:";
  const port = Number(urlObj.port) || (isHttps ? 443 : 80);
  const requestText = createRawGetRequest(urlObj, options);

  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    let socket;

    const onError = (error) => {
      if (!settled) {
        settled = true;
        if (socket && !socket.destroyed) {
          socket.destroy();
        }
        reject(error);
      }
    };

    const onEnd = () => {
      if (settled) {
        return;
      }

      settled = true;
      try {
        const response = parseHttpResponse(Buffer.concat(chunks));
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };

    const options = {
      host: urlObj.hostname,
      port,
    };

    socket = isHttps
      ? tls.connect({ ...options, servername: urlObj.hostname })
      : net.connect(options);

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => onError(new Error(`Socket timeout after ${timeoutMs} ms.`)));
    socket.on("error", onError);
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", onEnd);

    if (isHttps) {
      socket.on("secureConnect", () => {
        socket.write(requestText);
      });
    } else {
      socket.on("connect", () => {
        socket.write(requestText);
      });
    }
  });
}

function resolveRedirectUrl(currentUrl, locationHeader) {
  if (!locationHeader) {
    throw new Error("Redirect response is missing Location header.");
  }

  const locationValue = locationHeader.trim();
  return new URL(locationValue, currentUrl);
}

async function fetchWithRedirects(initialUrl, options = {}) {
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : 5;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 15000;
  const cacheEnabled = options.cacheEnabled !== false;
  const fallbackTtlSeconds = Number.isFinite(options.cacheTtlSeconds)
    ? options.cacheTtlSeconds
    : 90;
  const acceptHeader = options.acceptHeader || "text/html,application/json;q=0.9,*/*;q=0.8";

  let currentUrl = initialUrl;
  const visited = new Set();
  const redirectChain = [];
  const requestTrace = [];
  const cacheStats = { hits: 0, misses: 0, writes: 0 };

  for (let step = 0; step <= maxRedirects; step += 1) {
    const normalized = currentUrl.toString();
    if (visited.has(normalized)) {
      throw new Error(`Redirect loop detected at ${normalized}`);
    }
    visited.add(normalized);

    let response;
    let fromCache = false;

    const cacheKey = createCacheKey(currentUrl, acceptHeader);
    if (cacheEnabled) {
      const cached = await getCachedResponse(cacheKey);
      if (cached) {
        response = cached.response;
        fromCache = true;
        cacheStats.hits += 1;
      } else {
        cacheStats.misses += 1;
      }
    }

    if (!response) {
      response = await makeSocketRequest(currentUrl, timeoutMs, { acceptHeader });

      if (cacheEnabled) {
        const wrote = await storeCachedResponse(cacheKey, response, fallbackTtlSeconds);
        if (wrote) {
          cacheStats.writes += 1;
        }
      }
    }

    requestTrace.push({
      url: currentUrl.toString(),
      statusCode: response.statusCode,
      fromCache,
    });

    const locationHeader = response.headers.location;

    if (!REDIRECT_STATUS_CODES.has(response.statusCode)) {
      return {
        response,
        finalUrl: currentUrl,
        redirectChain,
        requestTrace,
        cacheStats,
      };
    }

    if (step === maxRedirects) {
      throw new Error(`Too many redirects (limit: ${maxRedirects}).`);
    }

    const nextUrl = resolveRedirectUrl(currentUrl, locationHeader);
    redirectChain.push({
      from: currentUrl.toString(),
      to: nextUrl.toString(),
      statusCode: response.statusCode,
    });
    currentUrl = nextUrl;
  }

  throw new Error("Unexpected redirect state.");
}

module.exports = {
  fetchWithRedirects,
  makeSocketRequest,
  normalizeUrl,
};
