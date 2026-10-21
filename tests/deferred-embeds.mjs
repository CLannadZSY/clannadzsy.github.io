import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/deferred-embeds.js', import.meta.url), 'utf8');

function environment({ ads = 2, comments = true, observers = true, idle = true, complete = false } = {}) {
  const scripts = [];
  const observersCreated = [];
  const idleTasks = [];
  const timers = [];
  const windowEvents = new Map();
  const element = () => ({
    dataset: {}, attributes: {}, events: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
    addEventListener(name, callback) { this.events[name] = callback; },
    appendChild(child) { scripts.push(child); },
  });
  const adSlots = Array.from({ length: ads }, () => {
    const unit = element();
    return { dataset: {}, querySelector: () => unit };
  });
  const commentMount = element();
  commentMount.dataset = { repo: 'CLannadZSY/clannadzsy.github.io', issueTerm: 'title', theme: 'github-light' };
  const commentSlots = comments ? [{ dataset: {}, querySelector: () => commentMount }] : [];
  const document = {
    readyState: complete ? 'complete' : 'loading',
    querySelectorAll: (selector) => selector === '[data-ad-container]' ? adSlots : commentSlots,
    createElement: element,
    head: { appendChild: (script) => { scripts.push(script); } },
  };
  const window = {
    addEventListener: (name, callback) => { windowEvents.set(name, callback); },
    setTimeout: (callback) => { timers.push(callback); },
  };
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; observersCreated.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve(target) { this.targets = this.targets.filter((item) => item !== target); }
    notify(target, isIntersecting = true) { this.callback([{ target, isIntersecting }]); }
  }
  if (observers) window.IntersectionObserver = Observer;
  if (idle) window.requestIdleCallback = (callback) => { idleTasks.push(callback); };
  vm.runInNewContext(source, { window, document, IntersectionObserver: observers ? Observer : undefined });
  return { scripts, observersCreated, idleTasks, timers, windowEvents, adSlots, commentSlots, window };
}

const settle = async () => { for (let index = 0; index < 5; index += 1) await Promise.resolve(); };

// No ad or comment on a page means no observers, handlers or third-party requests.
const empty = environment({ ads: 0, comments: false });
assert.equal(empty.windowEvents.size, 0);
assert.equal(empty.scripts.length, 0);

// Wait for load + idle, then require visibility; an offscreen comment does not load.
const deferred = environment();
assert.equal(deferred.scripts.length, 0);
assert.equal(deferred.observersCreated.length, 0);
deferred.windowEvents.get('load')();
assert.equal(deferred.scripts.length, 0);
assert.equal(deferred.idleTasks.length, 1);
deferred.idleTasks.shift()();
assert.equal(deferred.observersCreated.length, 2);
const [adObserver, commentObserver] = deferred.observersCreated;
adObserver.notify(deferred.adSlots[0], false);
assert.equal(deferred.scripts.length, 0);
adObserver.notify(deferred.adSlots[0]);
adObserver.notify(deferred.adSlots[1]);
adObserver.notify(deferred.adSlots[0]);
assert.equal(deferred.scripts.length, 1, 'Concurrent ad slots must share one library request');
const adLibrary = deferred.scripts[0];
assert.match(adLibrary.src, /^https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-7158791715796373$/);
assert.equal(adLibrary.async, true);
assert.equal(adLibrary.crossOrigin, 'anonymous');
adLibrary.events.load();
await settle();
assert.equal(deferred.window.adsbygoogle.length, 2, 'Each visible slot queues exactly one request');
adObserver.notify(deferred.adSlots[1]);
await settle();
assert.equal(deferred.window.adsbygoogle.length, 2);
assert.equal(deferred.commentSlots[0].dataset.embedState, undefined);
commentObserver.notify(deferred.commentSlots[0]);
commentObserver.notify(deferred.commentSlots[0]);
assert.equal(deferred.scripts.length, 2);
const commentScript = deferred.scripts[1];
assert.equal(commentScript.src, 'https://utteranc.es/client.js');
assert.equal(commentScript.attributes.repo, 'CLannadZSY/clannadzsy.github.io');
assert.equal(commentScript.attributes['issue-term'], 'title');
assert.equal(commentScript.attributes.theme, 'github-light');
commentScript.events.load();
assert.equal(deferred.commentSlots[0].dataset.embedState, 'loaded');

// Older browsers retain functionality after load without either scheduling API.
const fallback = environment({ observers: false, idle: false, complete: true });
assert.equal(fallback.scripts.length, 0);
fallback.timers.shift()();
assert.equal(fallback.scripts.length, 2);
fallback.scripts.find((script) => script.src.includes('adsbygoogle')).events.load();
await settle();
assert.equal(fallback.window.adsbygoogle.length, 2);

// Blocked libraries leave a stable container and no unhandled rejected promise.
const blocked = environment({ observers: false, idle: false, complete: true });
blocked.timers.shift()();
blocked.scripts.find((script) => script.src.includes('adsbygoogle')).events.error(new Error('blocked'));
blocked.scripts.find((script) => script.src.includes('utteranc')).events.error(new Error('blocked'));
await settle();
assert.equal(blocked.window.adsbygoogle, undefined);
assert.ok(blocked.adSlots.every((slot) => slot.dataset.embedState === 'unavailable'));
assert.equal(blocked.commentSlots[0].dataset.embedState, 'unavailable');

console.log('Deferred embed checks passed: visibility/load/idle, deduplication, original comment settings, API fallback and blocked services.');
