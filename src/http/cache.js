"use strict";

const fs = require("fs/promises");
const path = require("path");

const CACHE_DIR = path.resolve(process.cwd(), ".go2web-cache");
const CACHE_FILE = path.join(CACHE_DIR, "http-cache.json");

let loaded = false;
let cacheData = { entries: {} };

function createCacheKey(urlObj, acceptHeader) {
  return `${urlObj.toString()}|accept=${acceptHeader || "*/*"}`;
}

async function ensureLoaded() {
  if (loaded) {
    return;
  }

  try {
    const content = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && parsed.entries) {
      cacheData = parsed;
    }
  } catch {
    cacheData = { entries: {} };
  }

  loaded = true;
}

async function persist() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData), "utf8");
}

function parseExpiry(headers, fallbackTtlSeconds) {
  const cacheControl = (headers["cache-control"] || "").toLowerCase();

  if (cacheControl.includes("no-store")) {
    return null;
  }

  const maxAgeMatch = cacheControl.match(/max-age\s*=\s*(\d+)/i);
  if (maxAgeMatch) {
    const maxAgeSeconds = Number.parseInt(maxAgeMatch[1], 10);
    if (Number.isFinite(maxAgeSeconds) && maxAgeSeconds >= 0) {
      return Date.now() + maxAgeSeconds * 1000;
    }
  }

  const expires = headers.expires;
  if (expires) {
    const ts = Date.parse(expires);
    if (Number.isFinite(ts)) {
      return ts;
    }
  }

  return Date.now() + fallbackTtlSeconds * 1000;
}

function serializeResponse(response) {
  return {
    statusCode: response.statusCode,
    statusMessage: response.statusMessage,
    headers: response.headers,
    bodyBase64: response.body.toString("base64"),
  };
}

function deserializeResponse(raw) {
  return {
    statusCode: raw.statusCode,
    statusMessage: raw.statusMessage,
    headers: raw.headers || {},
    body: Buffer.from(raw.bodyBase64 || "", "base64"),
  };
}

async function getCachedResponse(cacheKey) {
  await ensureLoaded();

  const entry = cacheData.entries[cacheKey];
  if (!entry) {
    return null;
  }

  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
    delete cacheData.entries[cacheKey];
    await persist();
    return null;
  }

  return {
    response: deserializeResponse(entry.response),
    expiresAt: entry.expiresAt,
  };
}

async function storeCachedResponse(cacheKey, response, fallbackTtlSeconds = 60) {
  await ensureLoaded();

  const expiresAt = parseExpiry(response.headers || {}, fallbackTtlSeconds);
  if (!expiresAt || expiresAt <= Date.now()) {
    return false;
  }

  cacheData.entries[cacheKey] = {
    expiresAt,
    response: serializeResponse(response),
  };
  await persist();
  return true;
}

async function clearHttpCache() {
  cacheData = { entries: {} };
  loaded = true;

  try {
    await fs.rm(CACHE_FILE, { force: true });
  } catch {
    // Ignore file-system cleanup errors and keep in-memory cache cleared.
  }
}

module.exports = {
  clearHttpCache,
  createCacheKey,
  getCachedResponse,
  storeCachedResponse,
};
