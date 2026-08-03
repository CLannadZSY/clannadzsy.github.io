import assert from 'node:assert/strict';
import { parseLooseJson } from '../assets/js/loose-json.mjs';

assert.deepEqual(parseLooseJson('{1:1}'), { 1: 1 });
assert.deepEqual(parseLooseJson("{name: 'Doks', active: True, empty: None,}"), {
  name: 'Doks',
  active: true,
  empty: null,
});
assert.deepEqual(parseLooseJson("{'text': '{1: True}', 2: False}"), {
  text: '{1: True}',
  2: false,
});
assert.throws(() => parseLooseJson('{value: alert(1)}'));

console.log('Loose JSON checks passed.');
