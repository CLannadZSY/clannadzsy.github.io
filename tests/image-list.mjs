import assert from 'node:assert/strict';
import '../assets/js/image-list.js';

const { parseImageList } = globalThis.imageListParser;

assert.deepEqual(parseImageList('["https://a.example/1.png", "https://b.example/2.jpg"]').urls, [
  'https://a.example/1.png',
  'https://b.example/2.jpg',
]);
assert.deepEqual(parseImageList('https://a.example/1.png\n\nhttps://b.example/2.jpg').urls, [
  'https://a.example/1.png',
  'https://b.example/2.jpg',
]);

const limited = parseImageList(Array.from({ length: 101 }, (_, index) => `https://example.com/${index}.png`).join('\n'));
assert.equal(limited.total, 101);
assert.equal(limited.urls.length, 100);
assert.throws(() => parseImageList('["ftp://example.com/a.png"]'), /只支持 HTTP 或 HTTPS/);
assert.throws(() => parseImageList('["https://a.example/a.png", 1]'), /必须是字符串/);

console.log('Image list checks passed.');
