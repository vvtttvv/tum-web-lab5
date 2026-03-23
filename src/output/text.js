"use strict";

function normalizeConsoleText(input) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

module.exports = {
  normalizeConsoleText,
};
