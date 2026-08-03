import JSON5 from 'json5';

function normalizePythonValues(source) {
  const contexts = [];
  let result = '';
  let quote = '';
  let comment = '';
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quote) {
      result += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }

    if (comment === 'line') {
      result += character;
      if (character === '\n') comment = '';
      continue;
    }

    if (comment === 'block') {
      result += character;
      if (character === '*' && next === '/') {
        result += next;
        index += 1;
        comment = '';
      }
      continue;
    }

    if (character === '"' || character === '\'') {
      quote = character;
      result += character;
      continue;
    }

    if (character === '/' && (next === '/' || next === '*')) {
      comment = next === '/' ? 'line' : 'block';
      result += character + next;
      index += 1;
      continue;
    }

    if (character === '{') {
      contexts.push({ type: 'object', expectsKey: true });
      result += character;
      continue;
    }

    if (character === '[') {
      contexts.push({ type: 'array' });
      result += character;
      continue;
    }

    if (character === '}' || character === ']') {
      contexts.pop();
      result += character;
      continue;
    }

    const context = contexts[contexts.length - 1];

    if (character === ',') {
      if (context && context.type === 'object') context.expectsKey = true;
      result += character;
      continue;
    }

    if (character === ':') {
      if (context && context.type === 'object') context.expectsKey = false;
      result += character;
      continue;
    }

    const number = /^[+-]?(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(source.slice(index));
    if (context && context.type === 'object' && context.expectsKey && number) {
      const afterNumber = source.slice(index + number[0].length);
      if (/^\s*:/.test(afterNumber)) {
        result += JSON.stringify(number[0]);
        index += number[0].length - 1;
        continue;
      }
    }

    const identifier = /^[A-Za-z_$][\w$]*/.exec(source.slice(index));
    if (identifier) {
      const value = identifier[0];
      const pythonValue = { True: 'true', False: 'false', None: 'null' }[value];
      const afterIdentifier = source.slice(index + value.length);

      if (context && context.type === 'object' && context.expectsKey && pythonValue && /^\s*:/.test(afterIdentifier)) {
        result += JSON.stringify(pythonValue);
      } else {
        result += pythonValue || value;
      }

      index += value.length - 1;
      continue;
    }

    result += character;
  }

  return result;
}

export function parseLooseJson(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    return JSON5.parse(normalizePythonValues(source));
  }
}

if (typeof window !== 'undefined') window.parseLooseJson = parseLooseJson;
