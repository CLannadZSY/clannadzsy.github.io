const passwordCrypto = typeof window === 'undefined' ? global.crypto : window.crypto;
const lowerCase = 'abcdefghijklmnopqrstuvwxyz';
const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const digits = '0123456789';
const symbols = '!@#$%^&*()-_=+[]{};:,.?';

function randomIndex(max) {
  const range = 0x100000000;
  const limit = range - (range % max);
  const values = new Uint32Array(1);

  do passwordCrypto.getRandomValues(values);
  while (values[0] >= limit);

  return values[0] % max;
}

function randomCharacter(characters) {
  return characters[randomIndex(characters.length)];
}

function shuffle(characters) {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join('');
}

function validateLength(length, min, max) {
  if (!Number.isInteger(length) || length < min || length > max) {
    throw new RangeError(`长度必须在 ${min} 到 ${max} 之间。`);
  }
}

function randomPassword(length, includeNumbers, includeSymbols) {
  validateLength(length, 8, 64);
  const groups = [lowerCase, upperCase];
  if (includeNumbers) groups.push(digits);
  if (includeSymbols) groups.push(symbols);

  const password = groups.map(randomCharacter);
  const allCharacters = groups.join('');
  while (password.length < length) password.push(randomCharacter(allCharacters));
  return shuffle(password);
}

function memorablePassword(wordCount) {
  validateLength(wordCount, 3, 8);
  const consonants = 'bcdfghjkmnpqrstvwxyz';
  const vowels = 'aeiou';
  const words = [];

  for (let index = 0; index < wordCount; index += 1) {
    words.push(
      randomCharacter(consonants) +
      randomCharacter(vowels) +
      randomCharacter(consonants) +
      randomCharacter(vowels) +
      randomCharacter(consonants)
    );
  }

  return words.join('-');
}

function pin(length) {
  validateLength(length, 4, 12);
  let value = '';
  while (value.length < length) value += randomCharacter(digits);
  return value;
}

const passwordGenerator = { randomPassword, memorablePassword, pin };

if (typeof window === 'undefined') global.passwordGenerator = passwordGenerator;
else window.passwordGenerator = passwordGenerator;
