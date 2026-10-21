import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
const calls = [];
const frames = [];
const timers = [];
const idle = [];
const window = {
  hljs: { highlightBlock: (block) => { calls.push(block.textContent); } },
  requestAnimationFrame: (callback) => { frames.push(callback); },
  setTimeout: (callback) => { timers.push(callback); },
  requestIdleCallback: (callback) => { idle.push(callback); },
};
const context = vm.createContext({ window, document: { querySelector: () => null } });
vm.runInContext(source, context);
const highlight = vm.runInContext('highlightToolOutput', context);
const flush = () => {
  while (frames.length) frames.shift()();
  while (timers.length) timers.shift()();
  while (idle.length) idle.shift()();
};

const block = { textContent: '{"small":true}', isConnected: true };
highlight(block);
assert.deepEqual(calls, ['{"small":true}']);
const large = 'x'.repeat(20000);
block.textContent = large;
highlight(block);
assert.equal(calls.length, 1, 'Large output must paint before coloring');
assert.equal(block.textContent, large, 'Copyable output must remain complete');
assert.equal(frames.length, 1);
frames.shift()();
assert.equal(calls.length, 1);
timers.shift()();
assert.equal(calls.length, 1, 'Coloring must wait for idle');
idle.shift()();
assert.equal(calls.at(-1), large);

// Rapid reformatting, including identical text, must discard stale callbacks.
highlight(block);
highlight(block);
const before = calls.length;
flush();
assert.equal(calls.length, before + 1);
highlight(block);
block.textContent = 'newer result';
flush();
assert.equal(calls.length, before + 1);
block.textContent = large;
highlight(block);
block.isConnected = false;
flush();
assert.equal(calls.length, before + 1);

// Browsers without idle scheduling still color after the first result frame.
block.isConnected = true;
delete window.requestIdleCallback;
highlight(block);
assert.equal(calls.length, before + 1);
flush();
assert.equal(calls.length, before + 2);
delete window.hljs;
assert.doesNotThrow(() => highlight(block));
window.hljs = { highlightBlock: (output) => { calls.push(output.textContent); } };
const boundary = { textContent: 'x'.repeat(16384), isConnected: true };
const boundaryStart = calls.length;
highlight(boundary);
assert.equal(calls.length, boundaryStart + 1);
boundary.textContent += 'x';
highlight(boundary);
assert.equal(calls.length, boundaryStart + 1);
flush();
assert.equal(calls.length, boundaryStart + 2);
console.log('Output highlight checks passed: first paint, complete text, stale result cancellation, detached output and idle fallback.');
