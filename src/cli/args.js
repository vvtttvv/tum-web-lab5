"use strict";

const HELP_TEXT = `go2web -u <URL>         # make an HTTP request to the specified URL and print the response
go2web -s <search-term> [--open <n>] # search term and print top 10 results, optionally open result by index
go2web --clear-cache   # clear local HTTP cache
go2web -h               # show this help`;

function parseArgs(argv) {
  if (!argv || argv.length === 0) {
    return { error: "Error: use -h, -u <URL>, or -s <search-term>." };
  }

  const hasHelp = argv.includes("-h") || argv.includes("--help");
  const hasClearCache = argv.includes("--clear-cache");
  const uIndex = argv.indexOf("-u");
  const sIndex = argv.indexOf("-s");
  const modeCount =
    Number(hasHelp) + Number(hasClearCache) + Number(uIndex !== -1) + Number(sIndex !== -1);

  if (modeCount > 1) {
    return { error: "Error: use only one main mode at a time." };
  }

  if (hasHelp) {
    return { mode: "help" };
  }

  if (hasClearCache) {
    if (argv.length > 1) {
      return { error: "Error: --clear-cache does not accept extra arguments." };
    }
    return { mode: "clear-cache" };
  }

  if (uIndex !== -1) {
    const url = argv[uIndex + 1];
    if (!url || url.startsWith("-")) {
      return { error: "Error: -u requires a URL." };
    }

    const extraTokens = argv.slice(uIndex + 2);
    if (extraTokens.length > 0) {
      return { error: "Error: unexpected arguments for -u mode." };
    }

    return { mode: "url", url };
  }

  if (sIndex !== -1) {
    const searchTokens = argv.slice(sIndex + 1);
    const terms = [];
    let openIndex;

    for (let i = 0; i < searchTokens.length; i += 1) {
      const token = searchTokens[i];

      if (token === "--open" || token === "-o") {
        const rawNumber = searchTokens[i + 1];
        if (!rawNumber || rawNumber.startsWith("-")) {
          return { error: "Error: --open requires a positive numeric index." };
        }

        const parsedIndex = Number.parseInt(rawNumber, 10);
        if (!Number.isFinite(parsedIndex) || Number.isNaN(parsedIndex) || parsedIndex < 1) {
          return { error: "Error: --open requires a positive numeric index." };
        }

        openIndex = parsedIndex;
        i += 1;
        continue;
      }

      if (token.startsWith("-")) {
        return { error: `Error: unknown option for -s mode: ${token}` };
      }

      terms.push(token);
    }

    const searchTerm = terms.join(" ").trim();
    if (!searchTerm) {
      return { error: "Error: -s requires a search term." };
    }
    return { mode: "search", searchTerm, openIndex };
  }

  return { error: "Error: use -h, -u <URL>, or -s <search-term>." };
}

module.exports = {
  HELP_TEXT,
  parseArgs,
};
