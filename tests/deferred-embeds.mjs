import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/deferred-embeds.js', import.meta.url), 'utf8');
const adMarkup = fs.readFileSync(new URL('../layouts/partials/main/ad-slot.html', import.meta.url), 'utf8');
const [, initializeAd] = adMarkup.match(/<script>([\s\S]*?)<\/script>/);

// Manual ads queue immediately, before the async library or any scrolling.
const pending = {};
vm.runInNewContext(initializeAd, { window: pending });
assert.equal(pending.adsbygoogle.length, 1);
vm.runInNewContext(initializeAd, { window: pending });
assert.equal(pending.adsbygoogle.length, 2, 'Each rendered unit must queue once');
let requests = 0;
const loadedLibrary = { push: () => { requests += 1; } };
vm.runInNewContext(initializeAd, { window: { adsbygoogle: loadedLibrary } });
assert.equal(requests, 1, 'An already loaded library must receive the unit request');

function environment({ comments = true, observers = true, idle = true, complete = false } = {}) {
  const scripts = [];
  const observersCreated = [];
  const idleTasks = [];
  const timers = [];
  const windowEvents = new Map();
  const element = () => ({
    dataset: {}, attributes: {}, events: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.events[name] = callback; },
    appendChild(child) { scripts.push(child); },
  });
  const commentMount = element();
  commentMount.dataset = { repo: 'CLannadZSY/clannadzsy.github.io', issueTerm: 'title', theme: 'github-light' };
  const commentSlots = comments ? [{ dataset: {}, querySelector: () => commentMount }] : [];
  const document = {
    readyState: complete ? 'complete' : 'loading',
    querySelectorAll: () => commentSlots,
    createElement: element,
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
  return { scripts, observersCreated, idleTasks, timers, windowEvents, commentSlots };
}

// Pages without comments need no deferred loader; ads use the separate head tag.
const empty = environment({ comments: false });
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
assert.equal(deferred.observersCreated.length, 1);
const [commentObserver] = deferred.observersCreated;
commentObserver.notify(deferred.commentSlots[0], false);
assert.equal(deferred.scripts.length, 0);
assert.equal(deferred.commentSlots[0].dataset.embedState, undefined);
commentObserver.notify(deferred.commentSlots[0]);
commentObserver.notify(deferred.commentSlots[0]);
assert.equal(deferred.scripts.length, 1);
const commentScript = deferred.scripts[0];
assert.equal(commentScript.src, 'https://utteranc.es/client.js');
assert.equal(commentScript.async, true);
assert.equal(commentScript.crossOrigin, 'anonymous');
assert.equal(commentScript.attributes.repo, 'CLannadZSY/clannadzsy.github.io');
assert.equal(commentScript.attributes['issue-term'], 'title');
assert.equal(commentScript.attributes.theme, 'github-light');
commentScript.events.load();
assert.equal(deferred.commentSlots[0].dataset.embedState, 'loaded');

// Older browsers retain functionality after load without either scheduling API.
const fallback = environment({ observers: false, idle: false, complete: true });
assert.equal(fallback.scripts.length, 0);
fallback.timers.shift()();
assert.equal(fallback.scripts.length, 1);
fallback.scripts[0].events.load();
assert.equal(fallback.commentSlots[0].dataset.embedState, 'loaded');

// Blocked libraries leave a stable container and no unhandled rejected promise.
const blocked = environment({ observers: false, idle: false, complete: true });
blocked.timers.shift()();
blocked.scripts[0].events.error(new Error('blocked'));
assert.equal(blocked.commentSlots[0].dataset.embedState, 'unavailable');

console.log('Embed checks passed: immediate ad queue, existing ad library, deferred comments, deduplication, API fallback and blocked services.');
