import { connect } from 'cloudflare:sockets';
import {
  buildHttpRequest,
  buildSocks4Connect,
  buildSocks5Auth,
  buildSocks5Connect,
  buildSocks5Greeting,
  parseHttpResponse,
  proxyCandidates,
  socks5ReplyError,
} from './proxy-check-core.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://clannad.icu',
  'https://www.clannad.icu',
  'https://clannadzsy.github.io',
]);

const concatBytes = (left, right) => {
  const output = new Uint8Array(left.length + right.length);
  output.set(left);
  output.set(right, left.length);
  return output;
};

const allowedOrigin = (origin) => {
  if (!origin || ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  } catch (error) {
    return false;
  }
};

const corsHeaders = (request) => {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (origin && allowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return headers;
};

const json = (request, payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: corsHeaders(request),
});

const httpResponseLength = (data) => {
  const text = new TextDecoder().decode(data);
  const headerEnd = text.indexOf('\r\n\r\n');
  if (headerEnd < 0) return 0;
  const header = text.slice(0, headerEnd);
  const contentLength = header.match(/\r\ncontent-length:\s*(\d+)/i)?.[1];
  if (contentLength) {
    const length = headerEnd + 4 + Number.parseInt(contentLength, 10);
    return data.length >= length ? length : 0;
  }
  if (/\r\ntransfer-encoding:\s*chunked/i.test(header)) {
    return text.includes('\r\n0\r\n\r\n', headerEnd + 4) ? data.length : 0;
  }
  return 0;
};

class SocketReader {
  constructor(stream) {
    this.reader = stream.getReader();
    this.buffer = new Uint8Array();
  }

  async readExact(size) {
    while (this.buffer.length < size) {
      const { done, value } = await this.reader.read();
      if (done) throw new Error('代理提前关闭了连接');
      this.buffer = concatBytes(this.buffer, value);
    }
    const output = this.buffer.slice(0, size);
    this.buffer = this.buffer.slice(size);
    return output;
  }

  async readHttpResponse() {
    // ponytail: IPinfo responses are capped at 64 KiB, simple concatenation is enough.
    let data = this.buffer;
    this.buffer = new Uint8Array();
    while (data.length <= 65536) {
      const completeLength = httpResponseLength(data);
      if (completeLength) return data.slice(0, completeLength);
      const { done, value } = await this.reader.read();
      if (done) return data;
      data = concatBytes(data, value);
    }
    throw new Error('IPinfo 响应过大');
  }
}

const write = async (socket, bytes) => {
  const writer = socket.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
};

const socks5Handshake = async (socket, reader, proxy) => {
  await write(socket, buildSocks5Greeting(proxy.auth));
  const greeting = await reader.readExact(2);
  if (greeting[0] !== 5 || greeting[1] === 0xff) throw new Error('SOCKS5 不接受认证方式');
  if (greeting[1] === 2) {
    if (!proxy.auth) throw new Error('SOCKS5 需要账号密码');
    await write(socket, buildSocks5Auth(proxy.username, proxy.password));
    const auth = await reader.readExact(2);
    if (auth[0] !== 1 || auth[1] !== 0) throw new Error('SOCKS5 账号或密码错误');
  } else if (greeting[1] !== 0) {
    throw new Error(`SOCKS5 不支持认证方式 ${greeting[1]}`);
  }

  await write(socket, buildSocks5Connect());
  const reply = await reader.readExact(4);
  if (reply[0] !== 5 || reply[1] !== 0) throw new Error(socks5ReplyError(reply[1]));
  if (reply[3] === 1) await reader.readExact(6);
  else if (reply[3] === 4) await reader.readExact(18);
  else if (reply[3] === 3) await reader.readExact((await reader.readExact(1))[0] + 2);
  else throw new Error('SOCKS5 返回了无效地址');
};

const socks4Handshake = async (socket, reader, proxy) => {
  await write(socket, buildSocks4Connect(proxy.username));
  const reply = await reader.readExact(8);
  if (reply[1] !== 0x5a) throw new Error(`SOCKS4 连接失败 (${reply[1]})`);
};

const checkCandidate = async (proxy, timeoutSeconds) => {
  let socket;
  let timer;
  const operation = async () => {
    socket = connect(
      { hostname: proxy.hostname, port: proxy.port },
      { allowHalfOpen: true, secureTransport: proxy.scheme === 'https' ? 'on' : 'off' },
    );
    await socket.opened;
    const reader = new SocketReader(socket.readable);

    if (proxy.scheme.startsWith('socks5')) await socks5Handshake(socket, reader, proxy);
    else if (proxy.scheme.startsWith('socks4')) await socks4Handshake(socket, reader, proxy);

    await write(socket, buildHttpRequest(proxy, proxy.scheme === 'http' || proxy.scheme === 'https'));
    return parseHttpResponse(await reader.readHttpResponse());
  };

  try {
    return await Promise.race([
      operation(),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('检测超时')), timeoutSeconds * 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (socket) await socket.close().catch(() => {});
  }
};

const checkProxy = async (rawProxy, selectedType, timeout) => {
  const result = {
    proxy: rawProxy,
    success: false,
    type: '-',
    auth: rawProxy.includes('@'),
    latency_ms: 0,
    exit_ip: '',
    error: '',
  };

  let candidates;
  try {
    candidates = proxyCandidates(rawProxy, selectedType);
  } catch (error) {
    result.error = error.message;
    return result;
  }

  const errors = [];
  for (const candidate of candidates) {
    result.type = candidate.label;
    result.auth = candidate.auth;
    const started = performance.now();
    try {
      const info = await checkCandidate(candidate, timeout);
      result.success = true;
      result.latency_ms = Math.round(performance.now() - started);
      result.exit_ip = info.ip;
      return result;
    } catch (error) {
      errors.push(`${candidate.label}: ${error.message}`);
    }
  }
  result.error = errors.join('; ');
  return result;
};

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    if (!allowedOrigin(origin)) return json(request, { error: '当前网页来源不允许调用检测服务' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json(request, { ok: true });
    if (request.method !== 'POST' || url.pathname !== '/check') return json(request, { error: 'Not Found' }, 404);
    if (Number(request.headers.get('Content-Length') || 0) > 4096) return json(request, { error: '请求内容过大' }, 413);

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return json(request, { error: '请求 JSON 无效' }, 400);
    }
    const proxy = typeof payload.proxy === 'string' ? payload.proxy.trim() : '';
    const proxyType = payload.proxy_type || 'auto';
    const timeout = Number.parseInt(payload.timeout, 10) || 8;
    if (!proxy || proxy.length > 2048 || !['auto', 'http', 'https', 'socks4', 'socks5'].includes(proxyType) || timeout < 3 || timeout > 15) {
      return json(request, { error: '请求参数无效' }, 400);
    }
    return json(request, { result: await checkProxy(proxy, proxyType, timeout) });
  },
};
