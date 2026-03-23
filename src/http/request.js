"use strict";

const net = require("net");
const tls = require("tls");
const { parseHttpResponse } = require("./response");

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

module.exports = {
  makeSocketRequest,
  normalizeUrl,
};
