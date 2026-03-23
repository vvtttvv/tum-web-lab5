"use strict";
const { HELP_TEXT, parseArgs } = require("./cli/args");
const { fetchWithRedirects, normalizeUrl } = require("./http/request");
const { clearHttpCache } = require("./http/cache");
const { decodeBodyToText } = require("./http/response");
const { toHumanReadableText } = require("./output/text");
const { searchTop10 } = require("./search/duckduckgo");
const { formatSearchResults } = require("./output/search");

function printHelp() {
  process.stdout.write(`${HELP_TEXT}\n`);
}

async function fetchAndPrintReadableUrl(urlValue) {
  const urlObj = normalizeUrl(urlValue);
  const { response, finalUrl, redirectChain, cacheStats } = await fetchWithRedirects(urlObj, {
    maxRedirects: 7,
    timeoutMs: 15000,
    cacheEnabled: true,
    cacheTtlSeconds: 120,
  });
  const textBody = decodeBodyToText(response);
  const output = toHumanReadableText(textBody, response.headers["content-type"]);

  if (redirectChain.length > 0) {
    for (const hop of redirectChain) {
      process.stdout.write(`Redirect ${hop.statusCode}: ${hop.from} -> ${hop.to}\n`);
    }
    process.stdout.write("\n");
  }

  process.stdout.write(`HTTP ${response.statusCode} ${response.statusMessage}\n`);
  process.stdout.write(`Final URL: ${finalUrl.toString()}\n`);
  process.stdout.write(
    `Cache: hits=${cacheStats.hits} misses=${cacheStats.misses} writes=${cacheStats.writes}\n`
  );
  process.stdout.write("\n");
  process.stdout.write(output);
  process.stdout.write("\n");
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

  if (parsed.mode === "clear-cache") {
    await clearHttpCache();
    process.stdout.write("HTTP cache cleared.\n");
    return 0;
  }

  if (parsed.mode === "url") {
    try {
      await fetchAndPrintReadableUrl(parsed.url);
      return 0;
    } catch (error) {
      process.stderr.write(`Request failed: ${error.message}\n`);
      return 1;
    }
  }

  if (parsed.mode === "search") {
    try {
      const results = await searchTop10(parsed.searchTerm);

      if (parsed.openIndex) {
        if (parsed.openIndex > results.length) {
          process.stderr.write(
            `Search failed: result #${parsed.openIndex} is out of range (got ${results.length}).\n`
          );
          return 1;
        }

        const selected = results[parsed.openIndex - 1];
        process.stdout.write(`Opening result #${parsed.openIndex}: ${selected.url}\n\n`);
        await fetchAndPrintReadableUrl(selected.url);
        //  https://support.google.com/websearch/answer/464?hl=en
        return 0;
      }

      const output = formatSearchResults(parsed.searchTerm, results);
      process.stdout.write(`${output}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`Search failed: ${error.message}\n`);
      return 1;
    }
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
