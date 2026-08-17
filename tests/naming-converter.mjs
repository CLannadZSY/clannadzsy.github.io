import assert from 'node:assert/strict';
import '../assets/js/naming-converter.js';

const { toCamel, toSnake } = globalThis.namingConverter;

assert.equal(toCamel('hello_world'), 'helloWorld');
assert.equal(toCamel('HELLO_WORLD'), 'helloWorld');
assert.equal(toCamel('_private_value_'), '_privateValue_');
assert.equal(toCamel('alreadyCamel'), 'alreadyCamel');

assert.equal(toSnake('helloWorld'), 'hello_world');
assert.equal(toSnake('HTTPRequest'), 'http_request');
assert.equal(toSnake('userID'), 'user_id');
assert.equal(toSnake('_privateValue_'), '_private_value_');

console.log('Naming converter checks passed.');
