"use strict";

const net = require("net");
const tls = require("tls");
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

function createRawGetRequest(urlObj) {
  const path = `${urlObj.pathname || "/"}${urlObj.search || ""}`;
  const hostHeader = urlObj.port ? `${urlObj.hostname}:${urlObj.port}` : urlObj.hostname;

  return [
    `GET ${path} HTTP/1.1`,
    `Host: ${hostHeader}`,
    "User-Agent: go2web/0.1",
    "Connection: close",
    "Accept: text/html,application/json;q=0.9,*/*;q=0.8",
    "",
    "",
  ].join("\r\n");
}

function makeSocketRequest(urlObj, timeoutMs = 15000) {
  const isHttps = urlObj.protocol === "https:";
  const port = Number(urlObj.port) || (isHttps ? 443 : 80);
  const requestText = createRawGetRequest(urlObj);

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

  let currentUrl = initialUrl;
  const visited = new Set();
  const redirectChain = [];

  for (let step = 0; step <= maxRedirects; step += 1) {
    const normalized = currentUrl.toString();
    if (visited.has(normalized)) {
      throw new Error(`Redirect loop detected at ${normalized}`);
    }
    visited.add(normalized);

    const response = await makeSocketRequest(currentUrl, timeoutMs);
    const locationHeader = response.headers.location;

    if (!REDIRECT_STATUS_CODES.has(response.statusCode)) {
      return {
        response,
        finalUrl: currentUrl,
        redirectChain,
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
