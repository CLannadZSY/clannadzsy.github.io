import assert from 'node:assert/strict';
import '../assets/js/totp.js';

const { importSecret, generate } = globalThis.totpGenerator;
// RFC 6238 Appendix B, SHA-1 vectors reduced to the default six digits.
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const key = await importSecret(secret);
for (const [seconds, expected] of [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
]) {
  assert.equal(await generate(key, seconds * 1000), expected);
}
const normalizedKey = await importSecret('gezd gnbv gy3t qojq\ngezdgnbvgy3tqojq');
assert.equal(await generate(normalizedKey, 59000), '287082');
assert.equal(await generate(key, 59999), '287082');
assert.notEqual(await generate(key, 60000), '287082');
assert.equal(key.extractable, false);
for (const valid of ['MY', 'MY======', 'MZXQ====', 'MZXW6===', 'MZXW6YQ=', 'MZXW6YTB']) {
  assert.ok(await importSecret(valid));
}
for (const invalid of ['', '   ', 'A', 'ABC', 'M1======', 'MY=', 'MY=======', 'MY======A', 'MZ', 'A'.repeat(257)]) {
  await assert.rejects(() => importSecret(invalid), /Base32/);
}
await assert.rejects(() => generate(key, -1), /时间/);
await assert.rejects(() => generate(key, NaN), /时间/);
console.log('TOTP checks passed: RFC vectors, leading zeros, time boundaries, Base32 normalization and validation.');
