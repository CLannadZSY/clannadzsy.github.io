import assert from 'node:assert/strict';
import '../assets/js/curl-to-requests.js';

const { convertCurlToRequests } = globalThis;

const result = convertCurlToRequests(`curl 'https://example.com/api' \\
  -H 'Content-Type: application/json' \\
  --data-raw '{"active":true,"count":2}'`);

assert.match(result, /requests\.post/);
assert.match(result, /"active": True/);
assert.match(result, /json=payload/);
assert.match(convertCurlToRequests('curl -G https://example.com -d "q=test"'), /params=params/);
assert.throws(() => convertCurlToRequests('curl https://example.com --form file=@a.txt'), /暂不支持/);

const cookieResult = convertCurlToRequests("curl https://example.com -b 'session=abc==; theme=dark'");
assert.match(cookieResult, /cookies = \{/);
assert.match(cookieResult, /"session": "abc=="/);
assert.match(cookieResult, /"theme": "dark"/);
assert.match(cookieResult, /cookies=cookies/);
assert.doesNotMatch(cookieResult, /"Cookie"/);

console.log('cURL to requests checks passed.');
