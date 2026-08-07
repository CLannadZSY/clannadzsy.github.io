import assert from 'node:assert/strict';
import '../assets/js/timestamp-converter.js';

const converter = globalThis.timestampConverter;

assert.deepEqual(converter.parse('1786094802'), { epochMs: 1786094802000, unit: 'seconds' });
assert.deepEqual(converter.parse('1786094802000'), { epochMs: 1786094802000, unit: 'milliseconds' });

const epoch = converter.format(0, 'Asia/Shanghai');
assert.equal(epoch.local, '1970-01-01 08:00:00 UTC+08:00');
assert.equal(epoch.iso, '1970-01-01T00:00:00.000Z');
assert.equal(converter.fromLocal('1970-01-01', '08:00:00', 'Asia/Shanghai').epochMs, 0);

assert.throws(
  () => converter.fromLocal('2024-03-10', '02:30:00', 'America/New_York'),
  /不存在这个时间/,
);
assert.match(
  converter.fromLocal('2024-11-03', '01:30:00', 'America/New_York').warning,
  /夏令时歧义/,
);
assert.equal(converter.relative(60000, 0), '1分钟后');
assert.throws(() => converter.parse('not-a-time'), /有效的 Unix 时间戳/);

console.log('Timestamp converter checks passed.');
