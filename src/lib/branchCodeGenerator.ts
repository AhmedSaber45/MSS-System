import {
  tokenizeProductName,
  getTransliteratedChar,
  getFirstLetterOfWord,
} from './productCodeGenerator.ts';

/**
 * Generate a branch or warehouse code based on the branch name.
 *
 * Rules:
 * - 1 word: First TWO letters of that word.
 * - 2 words: First letter of each word.
 * - 3 words: First letter of each word.
 * - >3 words: First letter of the first three words only.
 *
 * Handles both Arabic and English names deterministically.
 * Avoids duplicate codes if existingCodes list is provided.
 */
export function generateBranchCode(name: string, existingCodes: string[] = []): string {
  if (!name || typeof name !== 'string') return '';

  const words = tokenizeProductName(name);
  if (words.length === 0) return '';

  let rawCode = '';

  if (words.length === 1) {
    const word = words[0];
    const letters: string[] = [];
    for (const ch of word) {
      const trans = getTransliteratedChar(ch);
      if (trans) {
        letters.push(trans);
        if (letters.length === 2) break;
      }
    }
    rawCode = letters.join('');
  } else if (words.length === 2) {
    const l1 = getFirstLetterOfWord(words[0]);
    const l2 = getFirstLetterOfWord(words[1]);
    rawCode = `${l1}${l2}`;
  } else if (words.length === 3) {
    const l1 = getFirstLetterOfWord(words[0]);
    const l2 = getFirstLetterOfWord(words[1]);
    const l3 = getFirstLetterOfWord(words[2]);
    rawCode = `${l1}${l2}${l3}`;
  } else {
    // More than 3 words: take first letter of the first three words only
    const l1 = getFirstLetterOfWord(words[0]);
    const l2 = getFirstLetterOfWord(words[1]);
    const l3 = getFirstLetterOfWord(words[2]);
    rawCode = `${l1}${l2}${l3}`;
  }

  rawCode = rawCode.trim().toUpperCase();
  if (!rawCode) return '';

  // Check duplicates against existingCodes
  const normalizedExisting = new Set(
    existingCodes.map(c => (typeof c === 'string' ? c.trim().toUpperCase() : ''))
  );

  if (!normalizedExisting.has(rawCode)) {
    return rawCode;
  }

  // Duplicate resolution: append suffix 2, 3, ...
  let suffix = 2;
  while (normalizedExisting.has(`${rawCode}${suffix}`)) {
    suffix++;
  }
  return `${rawCode}${suffix}`;
}
