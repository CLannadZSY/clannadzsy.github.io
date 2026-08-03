import assert from 'node:assert/strict';
import '../assets/js/password-generator.js';

const { passwordGenerator } = globalThis;

for (let index = 0; index < 50; index += 1) {
  const password = passwordGenerator.randomPassword(20, true, true);
  assert.equal(password.length, 20);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[!@#$%^&*()\-_=+[\]{};:,.?]/);
}

assert.match(passwordGenerator.memorablePassword(4), /^(?:[bcdfghjkmnpqrstvwxyz][aeiou]){2}[bcdfghjkmnpqrstvwxyz](?:-(?:[bcdfghjkmnpqrstvwxyz][aeiou]){2}[bcdfghjkmnpqrstvwxyz]){3}$/);
assert.match(passwordGenerator.pin(6), /^\d{6}$/);
assert.throws(() => passwordGenerator.randomPassword(7, true, true), RangeError);

console.log('Password generator checks passed.');
