"use strict";

function parseHttpResponse(rawResponseBuffer) {
  const separator = Buffer.from("\r\n\r\n", "utf8");
  const splitIndex = rawResponseBuffer.indexOf(separator);

  if (splitIndex === -1) {
    throw new Error("Invalid HTTP response: header delimiter was not found.");
  }

  const rawHeaders = rawResponseBuffer.subarray(0, splitIndex).toString("utf8");
  const body = rawResponseBuffer.subarray(splitIndex + separator.length);
  const headerLines = rawHeaders.split("\r\n");
  const statusLine = headerLines.shift() || "";

  const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})\s*(.*)$/i);
  if (!statusMatch) {
    throw new Error("Invalid HTTP response: malformed status line.");
  }

  const headers = {};
  for (const line of headerLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[name] = value;
  }

  return {
    statusCode: Number(statusMatch[1]),
    statusMessage: statusMatch[2] || "",
    headers,
    body,
  };
}

function decodeChunkedBody(buffer) {
  let offset = 0;
  const parts = [];

  while (offset < buffer.length) {
    const lineEnd = buffer.indexOf("\r\n", offset, "utf8");
    if (lineEnd === -1) {
      throw new Error("Invalid chunked body: missing chunk-size delimiter.");
    }

    const line = buffer.subarray(offset, lineEnd).toString("utf8").trim();
    const sizeHex = line.split(";")[0];
    const size = Number.parseInt(sizeHex, 16);
    if (!Number.isFinite(size) || Number.isNaN(size)) {
      throw new Error("Invalid chunked body: bad chunk-size value.");
    }

    offset = lineEnd + 2;

    if (size === 0) {
      break;
    }

    const chunkEnd = offset + size;
    if (chunkEnd > buffer.length) {
      throw new Error("Invalid chunked body: declared chunk exceeds body length.");
    }

    parts.push(buffer.subarray(offset, chunkEnd));
    offset = chunkEnd + 2;
  }

  return Buffer.concat(parts);
}

function getResponseBodyBytes(response) {
  const transferEncoding = (response.headers["transfer-encoding"] || "").toLowerCase();
  if (transferEncoding.includes("chunked")) {
    return decodeChunkedBody(response.body);
  }

  const contentLengthHeader = response.headers["content-length"];
  if (contentLengthHeader) {
    const length = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(length) && length >= 0 && response.body.length >= length) {
      return response.body.subarray(0, length);
    }
  }

  return response.body;
}

function resolveEncoding(contentType) {
  if (!contentType) {
    return "utf8";
  }

  const lower = contentType.toLowerCase();
  const match = lower.match(/charset\s*=\s*([^;\s]+)/i);
  if (!match) {
    return "utf8";
  }

  const charset = match[1].replaceAll('"', "").trim();
  if (charset === "utf-8" || charset === "utf8") {
    return "utf8";
  }
  if (charset === "latin1" || charset === "iso-8859-1") {
    return "latin1";
  }
  if (charset === "utf-16le") {
    return "utf16le";
  }

  return "utf8";
}

function decodeBodyToText(response) {
  const bodyBytes = getResponseBodyBytes(response);
  const encoding = resolveEncoding(response.headers["content-type"]);

  return bodyBytes.toString(encoding);
}

module.exports = {
  decodeBodyToText,
  parseHttpResponse,
};
