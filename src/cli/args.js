"use strict";

const HELP_TEXT = `go2web -u <URL>         # make an HTTP request to the specified URL and print the response
go2web -s <search-term> [--open <n>] # search term and print top 10 results, optionally open result by index
go2web -u <URL> --accept <auto|html|json> # choose Accept/content rendering mode
go2web --clear-cache   # clear local HTTP cache
go2web -h               # show this help`;

const ALLOWED_ACCEPT_MODES = new Set(["auto", "html", "json"]);

function parseAcceptOption(tokens, state) {
  const token = tokens[state.index];
  if (token !== "--accept") {
    return false;
  }

  const rawMode = tokens[state.index + 1];
  if (!rawMode || rawMode.startsWith("-")) {
    state.error = "Error: --accept requires one of: auto, html, json.";
    return true;
  }

  const mode = rawMode.toLowerCase();
  if (!ALLOWED_ACCEPT_MODES.has(mode)) {
    state.error = "Error: --accept requires one of: auto, html, json.";
    return true;
  }

  state.acceptMode = mode;
  state.index += 1;
  return true;
}

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
    const state = {
      acceptMode: "auto",
      index: 0,
      error: null,
    };

    while (state.index < extraTokens.length) {
      if (parseAcceptOption(extraTokens, state)) {
        if (state.error) {
          return { error: state.error };
        }
        state.index += 1;
        continue;
      }

      return { error: `Error: unexpected argument for -u mode: ${extraTokens[state.index]}` };
    }

    return { mode: "url", url, acceptMode: state.acceptMode };
  }

  if (sIndex !== -1) {
    const searchTokens = argv.slice(sIndex + 1);
    const terms = [];
    let openIndex;
    let acceptMode = "auto";

    for (let i = 0; i < searchTokens.length; i += 1) {
      const token = searchTokens[i];

      if (token === "--accept") {
        const state = { acceptMode, index: i, error: null };
        parseAcceptOption(searchTokens, state);
        if (state.error) {
          return { error: state.error };
        }
        acceptMode = state.acceptMode;
        i += 1;
        continue;
      }

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
    return { mode: "search", searchTerm, openIndex, acceptMode };
  }

  return { error: "Error: use -h, -u <URL>, or -s <search-term>." };
}

module.exports = {
  HELP_TEXT,
  parseArgs,
};
