"use strict";

const HELP_TEXT = `go2web -u <URL>         # make an HTTP request to the specified URL and print the response
go2web -s <search-term> # make an HTTP request to search the term using your favorite search engine and print top 10 results
go2web -h               # show this help`;

function printHelp() {
  process.stdout.write(`${HELP_TEXT}\n`);
}

function parseArgs(argv) {
  if (!argv || argv.length === 0) {
    return { error: "Error: use -h, -u <URL>, or -s <search-term>." };
  }

  const hasHelp = argv.includes("-h") || argv.includes("--help");
  const uIndex = argv.indexOf("-u");
  const sIndex = argv.indexOf("-s");
  const modeCount = Number(hasHelp) + Number(uIndex !== -1) + Number(sIndex !== -1);

  if (modeCount > 1) {
    return { error: "Error: use only one of -h, -u, or -s." };
  }

  if (hasHelp) {
    return { mode: "help" };
  }

  if (uIndex !== -1) {
    const url = argv[uIndex + 1];
    if (!url || url.startsWith("-")) {
      return { error: "Error: -u requires a URL." };
    }
    return { mode: "url", url };
  }

  if (sIndex !== -1) {
    const terms = argv.slice(sIndex + 1).filter((item) => !item.startsWith("-"));
    const searchTerm = terms.join(" ").trim();
    if (!searchTerm) {
      return { error: "Error: -s requires a search term." };
    }
    return { mode: "search", searchTerm };
  }

  return { error: "Error: use -h, -u <URL>, or -s <search-term>." };
}

function main(argv) {
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
    process.stdout.write(`[WIP] URL mode accepted: ${parsed.url}\n`);
    process.stdout.write("HTTP client implementation will be added in next commit.\n");
    return 0;
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
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  HELP_TEXT,
  main,
  parseArgs,
};
