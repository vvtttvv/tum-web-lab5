"use strict";

const { makeSocketRequest } = require("../http/request");
const { decodeBodyToText } = require("../http/response");

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    );
}

function stripTags(text) {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBingRedirectTarget(raw) {
  if (!raw) {
    return "";
  }

  const normalized = raw.startsWith("a1") ? raw.slice(2) : raw;

  try {
    const decoded = Buffer.from(normalized, "base64").toString("utf8").trim();
    if (/^https?:\/\//i.test(decoded)) {
      return decoded;
    }
  } catch {
    console.warn("Warning: failed to decode Bing redirect target, falling back to heuristic decoding.");
  }

  try {
    const plain = decodeURIComponent(raw);
    if (/^https?:\/\//i.test(plain)) {
      return plain;
    }
  } catch {
    console.warn("Warning: failed to decode Bing redirect target, falling back to heuristic decoding.");
  }

  return "";
}

function resolveBingLink(href) {
  const cleanHref = decodeHtmlEntities(href || "").trim();
  const url = new URL(cleanHref, "https://www.bing.com");

  if (url.hostname.endsWith("bing.com") && url.pathname === "/ck/a") {
    const target = decodeBingRedirectTarget(url.searchParams.get("u") || "");
    if (target) {
      return target;
    }
  }

  return url.toString();
}

function parseBingResults(html, limit = 10) {
  const results = [];
  const blocks = html.match(/<li\s+class="b_algo"[\s\S]*?(?=<li\s+class="b_algo"|<\/ol>)/gi) || [];

  for (const block of blocks) {
    if (results.length >= limit) {
      break;
    }

    const titleMatch = block.match(
      /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i
    );

    if (!titleMatch) {
      continue;
    }

    const rawHref = titleMatch[1];
    const rawTitle = titleMatch[2];
    const snippetMatch = block.match(/<p>([\s\S]*?)<\/p>/i);
    const rawSnippet = snippetMatch ? snippetMatch[1] : "";

    try {
      const url = resolveBingLink(rawHref);
      const title = stripTags(rawTitle);
      const snippet = stripTags(rawSnippet);

      if (!url || !title) {
        continue;
      }

      results.push({
        title,
        url,
        snippet,
      });
    } catch {
      console.warn("Warning: failed to parse a Bing search result, skipping.");
    }
  }

  return results;
}

function buildBingSearchUrl(searchTerm) {
  const query = encodeURIComponent(searchTerm);
  return new URL(`https://www.bing.com/search?q=${query}&count=10`);
}

async function searchTop10(searchTerm) {
  const searchUrl = buildBingSearchUrl(searchTerm);
  const response = await makeSocketRequest(searchUrl);

  if (response.statusCode >= 400) {
    throw new Error(`Search request failed with status ${response.statusCode}.`);
  }

  const html = decodeBodyToText(response);
  return parseBingResults(html, 10);
}

module.exports = {
  parseBingResults,
  searchTop10,
};
