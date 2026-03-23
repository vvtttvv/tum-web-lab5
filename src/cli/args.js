"use strict";

const HELP_TEXT = `go2web -u <URL>         # make an HTTP request to the specified URL and print the response
go2web -s <search-term> # make an HTTP request to search the term using your favorite search engine and print top 10 results
go2web -h               # show this help`;

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

module.exports = {
  HELP_TEXT,
  parseArgs,
};
