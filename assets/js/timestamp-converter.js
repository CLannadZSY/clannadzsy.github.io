const timestampPad = (value) => String(value).padStart(2, '0');

const timestampUtcFromParts = (parts) => {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.getTime();
};

const timestampZone = (timeZone) => (
  timeZone === 'browser'
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    : timeZone
);

const timestampParts = (epochMs, timeZone) => {
  const values = {};
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timestampZone(timeZone),
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatter.formatToParts(new Date(epochMs)).forEach((part) => {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  });
  return values;
};

const timestampOffset = (epochMs, timeZone) => {
  const parts = timestampParts(epochMs, timeZone);
  return timestampUtcFromParts(parts) - Math.floor(epochMs / 1000) * 1000;
};

const timestampOffsetLabel = (offsetMs) => {
  const minutes = Math.round(offsetMs / 60000);
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${timestampPad(Math.floor(absolute / 60))}:${timestampPad(absolute % 60)}`;
};

const timestampParse = (value, unit = 'auto') => {
  const input = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(input)) throw new Error('请输入有效的 Unix 时间戳');
  const number = Number(input);
  const detectedUnit = unit === 'auto' ? (Math.abs(number) >= 1e11 ? 'milliseconds' : 'seconds') : unit;
  const epochMs = detectedUnit === 'seconds' ? number * 1000 : number;
  if (!Number.isFinite(epochMs) || Number.isNaN(new Date(epochMs).getTime())) throw new Error('时间戳超出有效范围');
  return { epochMs, unit: detectedUnit };
};

const timestampFormat = (epochMs, timeZone) => {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) throw new Error('时间超出有效范围');
  const parts = timestampParts(epochMs, timeZone);
  const dateValue = `${parts.year}-${timestampPad(parts.month)}-${timestampPad(parts.day)}`;
  const timeValue = `${timestampPad(parts.hour)}:${timestampPad(parts.minute)}:${timestampPad(parts.second)}`;
  const offset = timestampOffsetLabel(timestampOffset(epochMs, timeZone));
  return {
    date: dateValue,
    time: timeValue,
    local: `${dateValue} ${timeValue} ${offset}`,
    offset,
    iso: date.toISOString(),
    seconds: Math.floor(epochMs / 1000),
    milliseconds: Math.trunc(epochMs),
  };
};

const timestampLocalParts = (dateValue, timeValue) => {
  const dateMatch = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeValue);
  if (!dateMatch || !timeMatch) throw new Error('请输入完整的日期和时间');
  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] || 0),
  };
  const check = new Date(timestampUtcFromParts(parts));
  if (check.getUTCFullYear() !== parts.year || check.getUTCMonth() + 1 !== parts.month
    || check.getUTCDate() !== parts.day || parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    throw new Error('日期时间无效');
  }
  return parts;
};

const timestampSameParts = (left, right) => (
  ['year', 'month', 'day', 'hour', 'minute', 'second'].every((key) => left[key] === right[key])
);

const timestampFromLocal = (dateValue, timeValue, timeZone) => {
  const parts = timestampLocalParts(dateValue, timeValue);
  const zone = timestampZone(timeZone);
  const naive = timestampUtcFromParts(parts);
  const offsets = new Set([-36, -24, -12, 0, 12, 24, 36].map((hours) => (
    timestampOffset(naive + hours * 3600000, zone)
  )));
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((candidate) => timestampSameParts(timestampParts(candidate, zone), parts))
    .filter((candidate, index, items) => items.indexOf(candidate) === index)
    .sort((left, right) => left - right);
  if (!candidates.length) throw new Error('该时区中不存在这个时间，可能处于夏令时切换区间');
  return {
    epochMs: candidates[0],
    warning: candidates.length > 1 ? '该时间存在夏令时歧义，已选择较早的时刻' : '',
  };
};

const timestampRelative = (epochMs, nowMs = Date.now()) => {
  const difference = Math.round((epochMs - nowMs) / 1000);
  const absolute = Math.abs(difference);
  if (absolute < 5) return '刚刚';
  const units = [
    [31536000, '年'],
    [2592000, '个月'],
    [86400, '天'],
    [3600, '小时'],
    [60, '分钟'],
    [1, '秒'],
  ];
  const [seconds, label] = units.find(([size]) => absolute >= size);
  return `${Math.round(absolute / seconds)}${label}${difference > 0 ? '后' : '前'}`;
};

const timestampTimeZones = () => {
  const common = ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London', 'America/New_York'];
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set(common.concat(supported))];
};

const timestampConverter = {
  format: timestampFormat,
  fromLocal: timestampFromLocal,
  parse: timestampParse,
  relative: timestampRelative,
  timeZones: timestampTimeZones,
};

if (typeof window === 'undefined') global.timestampConverter = timestampConverter;
else window.timestampConverter = timestampConverter;
