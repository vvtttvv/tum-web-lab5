"use strict";

function formatSearchResults(searchTerm, results) {
  if (!results.length) {
    return `No results found for: ${searchTerm}`;
  }

  const lines = [`Top ${results.length} results for: ${searchTerm}`, ""];

  for (let i = 0; i < results.length; i += 1) {
    const item = results[i];
    lines.push(`${i + 1}. ${item.title}`);
    lines.push(`   ${item.url}`);
    if (item.snippet) {
      lines.push(`   ${item.snippet}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

module.exports = {
  formatSearchResults,
};
