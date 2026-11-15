/**
 * Deterministic Arabic-to-Latin transliteration mapping.
 * Ensures consistent, deterministic English uppercase initials for Arabic words.
 */
export const ARABIC_TO_LATIN_MAP: Record<string, string> = {
  // Alef variants and Hamza
  'ا': 'A',
  'أ': 'A',
  'إ': 'A',
  'آ': 'A',
  'ء': 'A',
  'ى': 'A',
  'ئ': 'Y',
  'ؤ': 'W',
  // Consonants
  'ب': 'B',
  'ت': 'T',
  'ة': 'T',
  'ث': 'T',
  'ج': 'G',
  'ح': 'H',
  'خ': 'K',
  'د': 'D',
  'ذ': 'Z',
  'ر': 'R',
  'ز': 'Z',
  'س': 'S',
  'ش': 'S',
  'ص': 'S',
  'ض': 'D',
  'ط': 'T',
  'ظ': 'Z',
  'ع': 'A',
  'غ': 'G',
  'ف': 'F',
  'ق': 'Q',
  'ك': 'K',
  'ل': 'L',
  'م': 'M',
  'ن': 'N',
  'ه': 'H',
  'و': 'W',
  'ي': 'Y',
};

/**
 * Extract the uppercase Latin transliteration of a single character.
 * Returns empty string if the character is not a recognized letter.
 */
export function getTransliteratedChar(char: string): string {
  if (!char) return '';
  // English letter
  if (/[a-zA-Z]/.test(char)) {
    return char.toUpperCase();
  }
  // Arabic letter
  if (ARABIC_TO_LATIN_MAP[char]) {
    return ARABIC_TO_LATIN_MAP[char];
  }
  return '';
}

/**
 * Clean a word token:
 * - Strips leading/trailing punctuation and symbols.
 * - If the word starts with the Arabic definite article "ال" (or "أل" / "إل") and has >= 4 letters,
 *   strips "ال" so that "الماوس" correctly resolves to "ماوس" -> "MA".
 */
export function cleanWordToken(token: string): string {
  if (!token) return '';
  let cleaned = token.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');

  // Strip leading Arabic definite article "ال" if the word is at least 4 characters long
  // (e.g. "الماوس" -> "ماوس", but keep words like "ألم" or "إلخ")
  if (/^(?:ال|أل|إل)/.test(cleaned) && cleaned.length >= 4) {
    cleaned = cleaned.substring(2);
  }

  return cleaned;
}

/**
 * Tokenize a product name into significant words that contain at least one letter.
 */
export function tokenizeProductName(name: string): string[] {
  if (!name || typeof name !== 'string') return [];

  // Replace common delimiters and punctuation with spaces
  const normalized = name.replace(/[_\-/[\](){}|,;:.+*&"!?]/g, ' ');
  const rawTokens = normalized.split(/\s+/).filter(Boolean);

  const significantWords: string[] = [];

  for (const raw of rawTokens) {
    const cleaned = cleanWordToken(raw);
    if (!cleaned) continue;

    // Must contain at least one letter (Latin or Arabic)
    let hasLetter = false;
    for (const ch of cleaned) {
      if (getTransliteratedChar(ch)) {
        hasLetter = true;
        break;
      }
    }

    if (hasLetter) {
      significantWords.push(cleaned);
    }
  }

  return significantWords;
}

/**
 * Generate alphabetical code prefix based on product name:
 * - Case 1: One word -> Take the first TWO letters of the word.
 *   Examples:
 *   - Mouse -> MO
 *   - Keyboard -> KE
 *   - Headphones -> HE
 *   - Charger -> CH
 *   - ماوس -> MA (م=M, ا=A)
 *   - كيبورد -> KY (ك=K, ي=Y)
 *   - سماعة -> SM (س=S, م=M)
 * - Case 2: Two words -> Take the first letter of each word.
 *   Examples:
 *   - Gaming Mouse -> GM
 *   - Wireless Keyboard -> WK
 *   - Red Dragon -> RD
 *   - Original Charger -> OC
 * - Case 3: Three or more words -> Take only the first letter of the first THREE words.
 *   Examples:
 *   - Redragon Gaming Mouse -> RGM
 *   - HP Original Laptop Charger -> HOL
 *   - Logitech Wireless Gaming Mouse -> LWG
 *   - Samsung EVO Plus SSD Drive -> SEP
 *
 * Always returns English uppercase characters only.
 * Fallback for empty or invalid names: "PRD"
 */
export function generateProductCodePrefix(name: string): string {
  const words = tokenizeProductName(name);

  if (words.length === 0) {
    return 'PRD';
  }

  if (words.length === 1) {
    // Case 1: One-word -> first TWO letters
    const word = words[0];
    const letters: string[] = [];

    for (const ch of word) {
      const trans = getTransliteratedChar(ch);
      if (trans) {
        letters.push(trans);
        if (letters.length === 2) break;
      }
    }

    if (letters.length === 0) return 'PRD';
    return letters.join('');
  }

  if (words.length === 2) {
    // Case 2: Two-word -> first letter of each word
    const l1 = getFirstLetterOfWord(words[0]);
    const l2 = getFirstLetterOfWord(words[1]);
    const prefix = `${l1}${l2}`.trim();
    return prefix || 'PRD';
  }

  // Case 3: Three or more words -> first letter of first THREE words
  const l1 = getFirstLetterOfWord(words[0]);
  const l2 = getFirstLetterOfWord(words[1]);
  const l3 = getFirstLetterOfWord(words[2]);
  const prefix = `${l1}${l2}${l3}`.trim();
  return prefix || 'PRD';
}

function getFirstLetterOfWord(word: string): string {
  for (const ch of word) {
    const trans = getTransliteratedChar(ch);
    if (trans) return trans;
  }
  return '';
}

/**
 * Generate a complete, unique product code combining the newly generated
 * alphabetical prefix and the existing numeric suffix mechanism (3-digit zero-padded).
 *
 * Examples:
 * - First "Mouse" -> MO-001
 * - Second "Mouse" -> MO-002
 * - First "Gaming Mouse" -> GM-001
 * - Empty name -> PRD-001 (or next PRD sequence)
 *
 * @param productName Product name
 * @param existingProducts Array of existing products or codes to maintain sequence and ensure uniqueness
 */
export function generateNextProductCode(
  productName: string,
  existingProducts: Array<{ code: string } | string> = []
): string {
  const prefix = generateProductCodePrefix(productName);

  // Extract all existing product codes in uppercase
  const existingCodes = existingProducts.map(p =>
    typeof p === 'string' ? p.trim().toUpperCase() : p.code.trim().toUpperCase()
  );
  const existingCodesSet = new Set(existingCodes);

  // Find all existing numbers for this prefix (matching <PREFIX>-<NUM> or <PREFIX><NUM>)
  // Case-insensitive regex
  const regex = new RegExp(`^${prefix}-?(\\d+)$`, 'i');
  let maxNum = 0;

  for (const code of existingCodes) {
    const match = code.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;

  // Ensure uniqueness in case of manually added codes matching candidate
  while (existingCodesSet.has(candidate)) {
    nextNum++;
    candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  }

  return candidate;
}
