const totpCrypto = typeof window === 'undefined' ? global.crypto : window.crypto;

const importTotpSecret = async (secret) => {
  const normalized = secret.replace(/\s/g, '').toUpperCase();
  const match = /^([A-Z2-7]+)(=*)$/.exec(normalized);
  const padding = { 0: 0, 2: 6, 4: 4, 5: 3, 7: 1 };
  if (!match || normalized.length > 256 || padding[match[1].length % 8] === undefined ||
      (match[2].length && match[2].length !== padding[match[1].length % 8])) {
    throw new Error('请输入有效的 Base32 密钥（字母 A–Z、数字 2–7，可带末尾 =）。');
  }

  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const character of match[1]) {
    buffer = (buffer << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
    }
    buffer &= (1 << bits) - 1;
  }
  if (buffer) throw new Error('Base32 密钥末尾包含无效编码，请检查是否复制完整。');
  if (!totpCrypto || !totpCrypto.subtle) throw new Error('当前环境不支持安全计算，请使用 HTTPS 或 localhost 访问。');
  return totpCrypto.subtle.importKey('raw', new Uint8Array(bytes), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
};

const generateTotp = async (key, timestamp = Date.now()) => {
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('无效的时间。');
  const counter = Math.floor(timestamp / 30000);
  const message = new DataView(new ArrayBuffer(8));
  message.setUint32(0, Math.floor(counter / 0x100000000));
  message.setUint32(4, counter >>> 0);
  const digest = new Uint8Array(await totpCrypto.subtle.sign('HMAC', key, message.buffer));
  const offset = digest[digest.length - 1] & 15;
  const binary = new DataView(digest.buffer).getUint32(offset) & 0x7fffffff;
  return String(binary % 1000000).padStart(6, '0');
};

const totpGenerator = { importSecret: importTotpSecret, generate: generateTotp };
if (typeof window === 'undefined') global.totpGenerator = totpGenerator;
else window.totpGenerator = totpGenerator;
