"use strict";

const net = require("net");
const tls = require("tls");

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

function normalizeUrl(input) {
  const candidate = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https protocols are supported.");
  }

  return parsed;
}

function createRawGetRequest(urlObj) {
  const path = `${urlObj.pathname || "/"}${urlObj.search || ""}`;
  const hostHeader = urlObj.port ? `${urlObj.hostname}:${urlObj.port}` : urlObj.hostname;

  return [
    `GET ${path} HTTP/1.1`,
    `Host: ${hostHeader}`,
    "User-Agent: go2web/0.1",
    "Connection: close",
    "Accept: text/html,application/json;q=0.9,*/*;q=0.8",
    "",
    "",
  ].join("\r\n");
}

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

function makeSocketRequest(urlObj, timeoutMs = 15000) {
  const isHttps = urlObj.protocol === "https:";
  const port = Number(urlObj.port) || (isHttps ? 443 : 80);
  const requestText = createRawGetRequest(urlObj);

  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    let socket;

    const onError = (error) => {
      if (!settled) {
        settled = true;
        if (socket && !socket.destroyed) {
          socket.destroy();
        }
        reject(error);
      }
    };

    const onEnd = () => {
      if (settled) {
        return;
      }

      settled = true;
      try {
        const response = parseHttpResponse(Buffer.concat(chunks));
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };

    const options = {
      host: urlObj.hostname,
      port,
    };

    socket = isHttps
      ? tls.connect({ ...options, servername: urlObj.hostname })
      : net.connect(options);

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => onError(new Error(`Socket timeout after ${timeoutMs} ms.`)));
    socket.on("error", onError);
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", onEnd);
    if (isHttps) {
      socket.on("secureConnect", () => {
        socket.write(requestText);
      });
    } else {
      socket.on("connect", () => {
        socket.write(requestText);
      });
    }
  });
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

      process.stdout.write(`HTTP ${response.statusCode} ${response.statusMessage}\n`);
      process.stdout.write("\n");
      process.stdout.write(response.body.toString("utf8"));
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
  makeSocketRequest,
  normalizeUrl,
  parseHttpResponse,
  parseArgs,
};
