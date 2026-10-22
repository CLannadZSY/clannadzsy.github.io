const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const TARGET_HOST = 'ipinfo.io';
export const TARGET_PORT = 80;
export const TARGET_URL = `http://${TARGET_HOST}/json`;

const LABELS = {
  http: 'HTTP',
  https: 'HTTPS',
  socks4: 'SOCKS4',
  socks4a: 'SOCKS4',
  socks5: 'SOCKS5',
  socks5h: 'SOCKS5',
};

const decodeCredential = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    throw new Error('代理认证信息的 URL 编码无效');
  }
};

const isPrivateLiteral = (hostname) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host === '::' || host === '::1') return true;
  if (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd') || /^fe[89ab]/.test(host))) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113);
};

export const proxyCandidates = (rawProxy, selectedType = 'auto') => {
  const raw = rawProxy.trim();
  if (!raw || /\s/.test(raw)) throw new Error('代理地址为空或包含空格');

  let explicitScheme = '';
  let authority = raw;
  if (raw.includes('://')) {
    [explicitScheme, authority] = raw.split(/:\/\/(.*)/s, 2);
    explicitScheme = explicitScheme.toLowerCase();
    if (!LABELS[explicitScheme]) throw new Error(`不支持 ${explicitScheme} 代理`);
  }

  const schemes = selectedType === 'auto'
    ? (explicitScheme ? [explicitScheme] : ['http', 'socks5h', 'socks4a'])
    : [{ socks5: 'socks5h', socks4: 'socks4a' }[selectedType] || selectedType];

  return schemes.map((scheme) => {
    let url;
    try {
      url = new URL(`${scheme}://${authority}`);
    } catch (error) {
      throw new Error('代理地址格式无效');
    }
    if (!LABELS[scheme] || !url.hostname || !url.port || !['', '/'].includes(url.pathname) || url.search || url.hash) {
      throw new Error('代理地址必须包含主机和端口');
    }
    const port = Number.parseInt(url.port, 10);
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('代理端口无效');
    if (isPrivateLiteral(hostname)) throw new Error('只支持公网代理');
    return {
      auth: Boolean(url.username || url.password),
      hostname,
      label: LABELS[scheme],
      password: decodeCredential(url.password),
      port,
      scheme,
      username: decodeCredential(url.username),
    };
  });
};

const joinBytes = (...parts) => {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
};

const portBytes = (port) => Uint8Array.of((port >> 8) & 0xff, port & 0xff);

export const buildSocks5Greeting = (auth) => (auth
  ? Uint8Array.of(5, 2, 0, 2)
  : Uint8Array.of(5, 1, 0));

export const buildSocks5Auth = (username, password) => {
  const user = encoder.encode(username);
  const pass = encoder.encode(password);
  if (!user.length || user.length > 255 || pass.length > 255) throw new Error('SOCKS5 账号或密码长度无效');
  return joinBytes(Uint8Array.of(1, user.length), user, Uint8Array.of(pass.length), pass);
};

export const buildSocks5Connect = () => {
  const host = encoder.encode(TARGET_HOST);
  return joinBytes(Uint8Array.of(5, 1, 0, 3, host.length), host, portBytes(TARGET_PORT));
};

export const buildSocks4Connect = (username = '') => joinBytes(
  Uint8Array.of(4, 1),
  portBytes(TARGET_PORT),
  Uint8Array.of(0, 0, 0, 1),
  encoder.encode(username),
  Uint8Array.of(0),
  encoder.encode(TARGET_HOST),
  Uint8Array.of(0),
);

const base64 = (value) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = encoder.encode(value);
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] || 0) << 8) | (bytes[index + 2] || 0);
    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? alphabet[chunk & 63] : '=';
  }
  return output;
};

export const buildHttpRequest = (proxy, absoluteForm = false) => {
  const authorization = proxy.auth
    ? `Proxy-Authorization: Basic ${base64(`${proxy.username}:${proxy.password}`)}\r\n`
    : '';
  const target = absoluteForm ? TARGET_URL : '/json';
  return encoder.encode(
    `GET ${target} HTTP/1.1\r\nHost: ${TARGET_HOST}\r\nAccept: application/json\r\n${authorization}Connection: close\r\n\r\n`,
  );
};

const decodeChunked = (body) => {
  let cursor = 0;
  const chunks = [];
  while (cursor < body.length) {
    let lineEnd = cursor;
    while (lineEnd + 1 < body.length && (body[lineEnd] !== 13 || body[lineEnd + 1] !== 10)) lineEnd += 1;
    if (lineEnd + 1 >= body.length) throw new Error('IPinfo 分块响应不完整');
    const size = Number.parseInt(decoder.decode(body.slice(cursor, lineEnd)).split(';', 1)[0], 16);
    if (!Number.isInteger(size) || size < 0) throw new Error('IPinfo 分块响应无效');
    if (size === 0) return decoder.decode(joinBytes(...chunks));
    cursor = lineEnd + 2;
    if (cursor + size + 2 > body.length || body[cursor + size] !== 13 || body[cursor + size + 1] !== 10) {
      throw new Error('IPinfo 分块响应不完整');
    }
    chunks.push(body.slice(cursor, cursor + size));
    cursor += size + 2;
  }
  throw new Error('IPinfo 分块响应不完整');
};

export const parseHttpResponse = (bytes) => {
  const response = decoder.decode(bytes);
  const headerEnd = response.indexOf('\r\n\r\n');
  if (headerEnd < 0) throw new Error('代理返回了无效的 HTTP 响应');
  const header = response.slice(0, headerEnd);
  const status = Number.parseInt(header.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i)?.[1], 10);
  if (!Number.isInteger(status) || status < 200 || status >= 300) throw new Error(`IPinfo 返回 HTTP ${status || '错误'}`);
  const chunked = /\r\ntransfer-encoding:\s*chunked/i.test(header);
  const body = chunked ? decodeChunked(bytes.slice(headerEnd + 4)) : response.slice(headerEnd + 4);
  let data;
  try {
    data = JSON.parse(body);
  } catch (error) {
    throw new Error('IPinfo 没有返回有效 JSON');
  }
  if (!data.ip) throw new Error('IPinfo 响应缺少出口 IP');
  return data;
};

export const socks5ReplyError = (code) => ({
  1: 'SOCKS5 一般故障',
  2: 'SOCKS5 规则不允许连接',
  3: 'SOCKS5 网络不可达',
  4: 'SOCKS5 主机不可达',
  5: 'SOCKS5 连接被拒绝',
  6: 'SOCKS5 TTL 超时',
  7: 'SOCKS5 不支持该命令',
  8: 'SOCKS5 不支持该地址类型',
}[code] || `SOCKS5 错误 ${code}`);
