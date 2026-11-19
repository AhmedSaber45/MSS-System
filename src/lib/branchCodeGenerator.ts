import {
  tokenizeProductName,
  getTransliteratedChar,
  getFirstLetterOfWord,
} from './productCodeGenerator.ts';

/**
 * Extract the prefix letters of a branch or warehouse name based on standard rules:
 * - 1 word: First TWO letters of that word.
 * - 2 words: First letter of each word.
 * - 3 words: First letter of each word.
 * - >3 words: First letter of the first three words only.
 *
 * Handles both Arabic and English names deterministically.
 */
export function extractBranchCodePrefix(name: string): string {
  if (!name || typeof name !== 'string') return '';

  const words = tokenizeProductName(name);
  if (words.length === 0) return '';

  let rawPrefix = '';

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
    rawPrefix = letters.join('');
  } else if (words.length === 2) {
    const l1 = getFirstLetterOfWord(words[0]);
    const l2 = getFirstLetterOfWord(words[1]);
    rawPrefix = `${l1}${l2}`;
  } else if (words.length === 3) {
    const l1 = getFirstLetterOfWord(words[0]);
    const l2 = getFirstLetterOfWord(words[1]);
    const l3 = getFirstLetterOfWord(words[2]);
    rawPrefix = `${l1}${l2}${l3}`;
  } else {
    // More than 3 words: take first letter of the first three words only
    const l1 = getFirstLetterOfWord(words[0]);
    const l2 = getFirstLetterOfWord(words[1]);
    const l3 = getFirstLetterOfWord(words[2]);
    rawPrefix = `${l1}${l2}${l3}`;
  }

  return rawPrefix.trim().toUpperCase();
}

/**
 * Generate a branch or warehouse code with sequential numeric suffix.
 *
 * Required format:
 * `PREFIX-001`
 *
 * Examples:
 * - Three-word name: TFA-001
 * - Two-word name: NC-002
 * - One-word name: CA-003
 *
 * Numeric suffix:
 * - Three-digit minimum format: 001, 002, 003, etc.
 * - Safe against collisions: finds the next available unique number for the prefix.
 * - Does NOT use a simple count of existing branches, preventing collisions
 *   when records are deleted, archived, or manually numbered.
 */
export function generateBranchCode(name: string, existingCodes: string[] = []): string {
  const prefix = extractBranchCodePrefix(name);
  if (!prefix) return '';

  const normalizedExisting = new Set<string>();
  const usedNumbersForPrefix = new Set<number>();

  for (const c of existingCodes) {
    if (typeof c === 'string' && c.trim()) {
      const clean = c.trim().toUpperCase();
      normalizedExisting.add(clean);

      // Check if this code belongs to the same prefix with a numeric suffix
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = clean.match(new RegExp(`^${escapedPrefix}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > 0) {
          usedNumbersForPrefix.add(num);
        }
      }
    }
  }

  // Find next available positive integer starting at 1
  let nextNum = 1;
  while (usedNumbersForPrefix.has(nextNum)) {
    nextNum++;
  }

  // Ensure candidate string is completely unique across all existing codes
  let candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  while (normalizedExisting.has(candidate)) {
    nextNum++;
    candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  }

  return candidate;
}
