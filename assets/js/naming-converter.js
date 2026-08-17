const convertIdentifier = (value, convert) => {
  const [, leading, identifier, trailing] = /^(_*)(.*?)(_*)$/.exec(value);
  return `${leading}${convert(identifier)}${trailing}`;
};

const toCamel = (value) => convertIdentifier(String(value), (identifier) => {
  if (!identifier.includes('_')) return identifier;
  return identifier.toLowerCase().replace(/_+([a-z0-9])/g, (_, character) => character.toUpperCase());
});

const toSnake = (value) => convertIdentifier(String(value), (identifier) => identifier
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase());

const namingConverter = { toCamel, toSnake };

if (typeof window === 'undefined') global.namingConverter = namingConverter;
else window.namingConverter = namingConverter;
