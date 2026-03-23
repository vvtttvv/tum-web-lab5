1. Show help:
   - `node src/go2web.js -h`
2. Show URL mode:
   - `node src/go2web.js -u https://example.com`
3. Show search top-10:
   - `node src/go2web.js -s internet`
4. Show open result:
   - `node src/go2web.js -s internet --open 4`
5. Show redirects:
   - `node src/go2web.js -u https://wikipedia.org`
6. Show content negotiation:
   - `node src/go2web.js -u https://jsonplaceholder.typicode.com/todos/1 --accept json`
7. Show cache:
   - `node src/go2web.js --clear-cache`
   - `node src/go2web.js -u https://example.com`
   - `node src/go2web.js -u https://example.com`
