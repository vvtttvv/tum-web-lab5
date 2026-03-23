"use strict";
const { HELP_TEXT, parseArgs } = require("./cli/args");
const { makeSocketRequest, normalizeUrl } = require("./http/request");
const { decodeBodyToText } = require("./http/response");
const { normalizeConsoleText } = require("./output/text");

function printHelp() {
  process.stdout.write(`${HELP_TEXT}\n`);
}

async function main(argv) {
  const parsed = parseArgs(argv);

  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n`);
    return 2;
  }

  if (parsed.mode === "help") {
    printHelp();
    return 0;
  }

  if (parsed.mode === "url") {
    try {
      const urlObj = normalizeUrl(parsed.url);
      const response = await makeSocketRequest(urlObj);
      const textBody = decodeBodyToText(response);
      const output = normalizeConsoleText(textBody);

      process.stdout.write(`HTTP ${response.statusCode} ${response.statusMessage}\n`);
      process.stdout.write("\n");
      process.stdout.write(output);
      process.stdout.write("\n");
      return 0;
    } catch (error) {
      process.stderr.write(`Request failed: ${error.message}\n`);
      return 1;
    }
  }

  if (parsed.mode === "search") {
    process.stdout.write(`[WIP] Search mode accepted: ${parsed.searchTerm}\n`);
    process.stdout.write("Search implementation will be added in next commit.\n");
    return 0;
  }

  process.stderr.write("Error: unsupported mode.\n");
  return 2;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`Fatal error: ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  HELP_TEXT,
  main,
  parseArgs,
};
