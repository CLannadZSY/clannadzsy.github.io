import assert from 'node:assert/strict';
import '../assets/js/proxy-check.js';
import {
  buildHttpRequest,
  buildSocks4Connect,
  buildSocks5Connect,
  buildSocks5Greeting,
  parseHttpResponse,
  proxyCandidates,
} from '../workers/proxy-check-core.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const authenticated = proxyCandidates('http://user:pass@example.com:8080')[0];
assert.equal(authenticated.auth, true);
assert.equal(authenticated.hostname, 'example.com');
assert.equal(authenticated.port, 8080);
assert.equal(proxyCandidates('example.com:1080').length, 3);
assert.equal(proxyCandidates('fcproxy.example.com:1080').length, 3);
assert.throws(() => proxyCandidates('127.0.0.1:1080'), /只支持公网代理/);
assert.throws(() => proxyCandidates('203.0.113.10:1080'), /只支持公网代理/);

assert.deepEqual([...buildSocks5Greeting(true)], [5, 2, 0, 2]);
assert.deepEqual([...buildSocks5Connect().slice(0, 5)], [5, 1, 0, 3, 9]);
assert.match(decoder.decode(buildSocks4Connect()), /ipinfo\.io/);
assert.match(decoder.decode(buildHttpRequest(authenticated, true)), /Proxy-Authorization: Basic dXNlcjpwYXNz/);

const body = '{"ip":"1.2.3.4"}';
const fixedResponse = encoder.encode(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n${body}`);
assert.equal(parseHttpResponse(fixedResponse).ip, '1.2.3.4');
const chunkedResponse = encoder.encode(`HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n${body.length.toString(16)}\r\n${body}\r\n0\r\n\r\n`);
assert.equal(parseHttpResponse(chunkedResponse).ip, '1.2.3.4');
const unicodeBody = '{"ip":"1.2.3.4","city":"杭州"}';
const unicodeBytes = encoder.encode(unicodeBody);
const unicodeChunkedResponse = new Uint8Array([
  ...encoder.encode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n'),
  ...encoder.encode(`${unicodeBytes.length.toString(16)}\r\n`),
  ...unicodeBytes,
  ...encoder.encode('\r\n0\r\n\r\n'),
]);
assert.equal(parseHttpResponse(unicodeChunkedResponse).city, '杭州');

let active = 0;
let maxActive = 0;
const mapped = await globalThis.proxyChecker.mapConcurrent([1, 2, 3, 4], 2, async (value) => {
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise((resolve) => { setTimeout(resolve, 5); });
  active -= 1;
  return value * 2;
});
assert.deepEqual(mapped, [2, 4, 6, 8]);
assert.equal(maxActive, 2);

console.log('ProxyCheck checks passed.');
