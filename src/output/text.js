"use strict";

function normalizeConsoleText(input) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

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

function htmlToReadableText(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, " ");
  const withoutNoise = withoutComments
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  const withBreaks = withoutNoise
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(title|p|div|section|article|main|header|footer|li|ul|ol|h[1-6]|tr|table)\s*>/gi, "\n");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  const lines = decoded
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const deduped = [];
  for (const line of lines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped.join("\n");
}

function jsonToReadableText(text) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return normalizeConsoleText(text).trim();
  }
}

function toHumanReadableText(text, contentType, acceptMode = "auto") {
  const normalized = normalizeConsoleText(text);
  const lowerContentType = (contentType || "").toLowerCase();

  if (acceptMode === "json") {
    return jsonToReadableText(normalized);
  }

  if (acceptMode === "html") {
    return htmlToReadableText(normalized);
  }

  if (lowerContentType.includes("application/json")) {
    return jsonToReadableText(normalized);
  }

  if (lowerContentType.includes("text/html")) {
    return htmlToReadableText(normalized);
  }

  return normalized.trim();
}

module.exports = {
  toHumanReadableText,
  normalizeConsoleText,
};
