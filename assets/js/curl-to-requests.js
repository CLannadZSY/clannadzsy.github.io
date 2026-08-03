function tokenize(command) {
  const source = command.replace(/[\\^`]\s*\r?\n/g, ' ').trim();
  const tokens = [];
  let token = '';
  let quote = '';
  let started = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quote === '\'') {
      if (character === '\'') quote = '';
      else token += character;
      continue;
    }

    if (quote === '"') {
      if (character === '"') {
        quote = '';
      } else if (character === '\\') {
        const next = source[index + 1];
        if ('"$`\\'.includes(next)) {
          token += next;
          index += 1;
        } else {
          token += character;
        }
      } else if ((character === '^' || character === '`') && source[index + 1]) {
        token += source[index + 1];
        index += 1;
      } else {
        token += character;
      }
      continue;
    }

    if (character === '\'' || character === '"') {
      quote = character;
      started = true;
    } else if ((character === '\\' || character === '^' || character === '`') && source[index + 1]) {
      token += source[index + 1];
      started = true;
      index += 1;
    } else if (/\s/.test(character)) {
      if (started || token) tokens.push(token);
      token = '';
      started = false;
    } else {
      token += character;
      started = true;
    }
  }

  if (quote) throw new Error('命令中存在未闭合的引号。');
  if (started || token) tokens.push(token);
  return tokens;
}

function pythonString(value) {
  return JSON.stringify(value);
}

function pythonValue(value, level = 0) {
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'string') return pythonString(value);
  if (typeof value === 'number') return String(value);

  const indent = '    '.repeat(level);
  const childIndent = '    '.repeat(level + 1);

  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((item) => `${childIndent}${pythonValue(item, level + 1)},`).join('\n')}\n${indent}]`;
  }

  const entries = Object.entries(value);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([key, item]) => `${childIndent}${pythonString(key)}: ${pythonValue(item, level + 1)},`).join('\n')}\n${indent}}`;
}

function optionValue(tokens, index, inlineValue, option) {
  const value = inlineValue === undefined ? tokens[index + 1] : inlineValue;
  if (value === undefined) throw new Error(`${option} 缺少参数值。`);
  return value;
}

function convertCurlToRequests(command) {
  const tokens = tokenize(command);
  const executable = (tokens.shift() || '').split(/[\\/]/).pop().toLowerCase();
  if (executable !== 'curl' && executable !== 'curl.exe') throw new Error('请输入以 curl 开头的命令。');

  const headers = [];
  const cookies = [];
  const dataParts = [];
  let url = '';
  let method = '';
  let auth = '';
  let timeout = '';
  let useQuery = false;
  let insecure = false;
  let jsonOption = false;

  const ignoredOptions = new Set([
    '-L', '--location', '--location-trusted', '--compressed', '-s', '--silent', '-S', '--show-error',
    '-i', '--include', '--http1.1', '--http2', '--globoff', '--path-as-is', '-v', '--verbose',
  ]);

  for (let index = 0; index < tokens.length; index += 1) {
    const rawToken = tokens[index];
    const equalsAt = rawToken.startsWith('--') ? rawToken.indexOf('=') : -1;
    const option = equalsAt > -1 ? rawToken.slice(0, equalsAt) : rawToken;
    const inlineValue = equalsAt > -1 ? rawToken.slice(equalsAt + 1) : undefined;
    const attachedOption = /^-[XHdub](.+)$/s.exec(rawToken);

    if (ignoredOptions.has(option)) continue;

    if (option === '--url') {
      url = optionValue(tokens, index, inlineValue, option);
      if (inlineValue === undefined) index += 1;
    } else if (option === '-X' || option === '--request' || (attachedOption && attachedOption[0].startsWith('-X'))) {
      method = attachedOption ? attachedOption[1] : optionValue(tokens, index, inlineValue, option);
      if (!attachedOption && inlineValue === undefined) index += 1;
    } else if (option === '-H' || option === '--header' || (attachedOption && attachedOption[0].startsWith('-H'))) {
      const header = attachedOption ? attachedOption[1] : optionValue(tokens, index, inlineValue, option);
      const separator = header.indexOf(':');
      if (separator < 1) throw new Error(`无法解析请求头：${header}`);
      headers.push([header.slice(0, separator).trim(), header.slice(separator + 1).trim()]);
      if (!attachedOption && inlineValue === undefined) index += 1;
    } else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode', '--json'].includes(option) || (attachedOption && attachedOption[0].startsWith('-d'))) {
      const data = attachedOption ? attachedOption[1] : optionValue(tokens, index, inlineValue, option);
      if (data.startsWith('@')) throw new Error('暂不支持从文件读取请求数据。');
      dataParts.push(data);
      jsonOption = jsonOption || option === '--json';
      if (!attachedOption && inlineValue === undefined) index += 1;
    } else if (option === '-b' || option === '--cookie' || (attachedOption && attachedOption[0].startsWith('-b'))) {
      const cookie = attachedOption ? attachedOption[1] : optionValue(tokens, index, inlineValue, option);
      if (cookie.startsWith('@')) throw new Error('暂不支持从文件读取 Cookie。');
      cookie.split(';').forEach((item) => {
        const separator = item.indexOf('=');
        if (separator < 1) throw new Error(`无法解析 Cookie：${item.trim()}`);
        cookies.push([item.slice(0, separator).trim(), item.slice(separator + 1).trim()]);
      });
      if (!attachedOption && inlineValue === undefined) index += 1;
    } else if (option === '-u' || option === '--user' || (attachedOption && attachedOption[0].startsWith('-u'))) {
      auth = attachedOption ? attachedOption[1] : optionValue(tokens, index, inlineValue, option);
      if (!attachedOption && inlineValue === undefined) index += 1;
    } else if (option === '--connect-timeout' || option === '--max-time') {
      timeout = optionValue(tokens, index, inlineValue, option);
      if (inlineValue === undefined) index += 1;
    } else if (option === '-G' || option === '--get') {
      useQuery = true;
    } else if (option === '-k' || option === '--insecure') {
      insecure = true;
    } else if (option === '-I' || option === '--head') {
      method = 'HEAD';
    } else if (rawToken.startsWith('-')) {
      throw new Error(`暂不支持 cURL 参数：${rawToken}`);
    } else if (!url) {
      url = rawToken;
    } else {
      throw new Error('当前仅支持转换一个请求地址。');
    }
  }

  if (!url) throw new Error('cURL 命令中缺少请求地址。');

  if (jsonOption) {
    if (!headers.some(([name]) => name.toLowerCase() === 'content-type')) headers.push(['Content-Type', 'application/json']);
    if (!headers.some(([name]) => name.toLowerCase() === 'accept')) headers.push(['Accept', 'application/json']);
  }

  const data = dataParts.join('&');
  const contentTypeHeader = headers.find(([name]) => name.toLowerCase() === 'content-type');
  const contentType = contentTypeHeader ? contentTypeHeader[1] : '';
  let jsonData;
  if (data && (jsonOption || contentType.toLowerCase().includes('application/json'))) {
    try {
      jsonData = JSON.parse(data);
    } catch (error) {
      if (jsonOption) throw new Error(`--json 数据不是有效 JSON：${error.message}`);
    }
  }

  method = (method || (data && !useQuery ? 'POST' : 'GET')).toUpperCase();
  const declarations = [`url = ${pythonString(url)}`];
  const requestArguments = ['url'];

  if (headers.length) {
    declarations.push(`headers = ${pythonValue(Object.fromEntries(headers))}`);
    requestArguments.push('headers=headers');
  }

  if (cookies.length) {
    declarations.push(`cookies = ${pythonValue(Object.fromEntries(cookies))}`);
    requestArguments.push('cookies=cookies');
  }

  if (data) {
    if (useQuery) {
      declarations.push(`params = ${pythonString(data)}`);
      requestArguments.push('params=params');
    } else if (jsonData !== undefined) {
      declarations.push(`payload = ${pythonValue(jsonData)}`);
      requestArguments.push('json=payload');
    } else {
      declarations.push(`data = ${pythonString(data)}`);
      requestArguments.push('data=data');
    }
  }

  if (auth) {
    const separator = auth.indexOf(':');
    const username = separator < 0 ? auth : auth.slice(0, separator);
    const password = separator < 0 ? '' : auth.slice(separator + 1);
    requestArguments.push(`auth=(${pythonString(username)}, ${pythonString(password)})`);
  }

  if (timeout) requestArguments.push(`timeout=${/^\d+(\.\d+)?$/.test(timeout) ? timeout : pythonString(timeout)}`);
  if (insecure) requestArguments.push('verify=False');

  const standardMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
  const requestCall = standardMethods.has(method) ? `requests.${method.toLowerCase()}` : 'requests.request';
  if (!standardMethods.has(method)) requestArguments.unshift(pythonString(method));

  const call = `${requestCall}(\n${requestArguments.map((argument) => `    ${argument},`).join('\n')}\n)`;
  return `import requests\n\n${declarations.join('\n\n')}\n\nresponse = ${call}\n\nprint(response.status_code)\nprint(response.text)`;
}

if (typeof window === 'undefined') global.convertCurlToRequests = convertCurlToRequests;
else window.convertCurlToRequests = convertCurlToRequests;
