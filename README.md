# go2web

CLI utility for HTTP over TCP sockets.

## Task Coverage

Implemented base requirements:

- `go2web -u <URL>`: make HTTP/HTTPS request and print response in human-readable form.
- `go2web -s <search-term>`: search and print top 10 results.
- `go2web -h`: print help.
- No built-in high-level HTTP clients are used (`http`, `https`, `fetch`, `axios` are not used).

Implemented extra points:

- Open result from search directly in CLI: `--open <n>`.
- HTTP redirects: 301/302/307/308 with max redirect limit and loop protection.
- HTTP cache: file-based cache with TTL and `Cache-Control`/`Expires` support.
- Content negotiation: `--accept auto|html|json` with format-aware output.
- Cache clear command: `--clear-cache`.

## Demo GIF

![go2web demo](gif_representation.gif)



## CLI Reference

```text
go2web -u <URL>
go2web -u <URL> --accept <auto|html|json>
go2web -s <search-term>
go2web -s <search-term> --open <n>
go2web -s <search-term> --open <n> --accept <auto|html|json>
go2web --clear-cache
go2web -h
```

## Usage Examples

```powershell
node src/go2web.js -u https://example.com
node src/go2web.js -u https://jsonplaceholder.typicode.com/todos/1 --accept json
node src/go2web.js -s internet
node src/go2web.js -s internet --open 4 --accept html
node src/go2web.js --clear-cache
```

## Notes

- Some websites return `403`/`202` due to anti-bot protection. This is expected behavior for raw CLI clients.
- Cache is stored in `.go2web-cache/http-cache.json`.
