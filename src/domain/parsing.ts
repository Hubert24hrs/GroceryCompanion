import { normalizeUnit } from './units';

export interface ParsedItem {
    name: string;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
    original: string;
}

const UNICODE_FRACTIONS: Record<string, number> = {
    '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const NUMBER_WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, half: 0.5, couple: 2,
};

/** Parse "2", "1.5", "1/2", "½", "1½" or "2x" into a number. */
export function parseNumber(token: string): number | null {
    const t = token.trim().toLowerCase().replace(/x$/, '');
    if (!t) return null;
    if (t in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[t];
    const mixedUnicode = t.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
    if (mixedUnicode) return Number(mixedUnicode[1]) + UNICODE_FRACTIONS[mixedUnicode[2]];
    const fraction = t.match(/^(\d+)\/(\d+)$/);
    if (fraction) {
        const den = Number(fraction[2]);
        return den === 0 ? null : Number(fraction[1]) / den;
    }
    if (/^\d+(\.\d+)?$/.test(t) || /^\.\d+$/.test(t)) return Number(t);
    return null;
}

function cleanLine(line: string): string {
    return line
        .replace(/^\s*(?:[-*•▢☐]|\[\s?[xX]?\s?\]|\d+[.)](?=\s))\s*/, '') // bullets, checkboxes, "1." numbering
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Parse one grocery phrase: "2 lbs chicken breast", "1 1/2 cups of milk",
 * "milk x2", "3x eggs", "a dozen eggs", "bananas (ripe)".
 */
export function parseItem(text: string): ParsedItem {
    const original = text;
    let rest = cleanLine(text);
    let notes: string | null = null;

    const paren = rest.match(/\(([^)]*)\)\s*$/);
    if (paren) {
        notes = paren[1].trim() || null;
        rest = rest.slice(0, paren.index).trim();
    }

    let quantity: number | null = null;
    let unit: string | null = null;

    // Trailing multiplier: "milk x2" / "milk × 2"
    const trailing = rest.match(/\s+[x×]\s?(\d+(?:\.\d+)?)$/i);
    if (trailing) {
        quantity = Number(trailing[1]);
        rest = rest.slice(0, trailing.index).trim();
    }

    const tokens = rest.split(' ');
    let i = 0;
    if (quantity === null && tokens.length > 1) {
        // Number words only count when they don't start a phrase like "half and half".
        const word = tokens[1].toLowerCase() === 'and' ? undefined : NUMBER_WORDS[tokens[0].toLowerCase()];
        const first = parseNumber(tokens[0]) ?? word ?? null;
        if (first !== null) {
            quantity = first;
            i = 1;
            // Mixed number: "1 1/2"
            if (tokens[i] && /^\d+\/\d+$/.test(tokens[i])) {
                quantity += parseNumber(tokens[i]) ?? 0;
                i++;
            }
            // "a dozen eggs" → 12 eggs is surprising in a list; keep the unit instead.
            if (tokens[i]) {
                const twoWord = tokens[i + 1] ? normalizeUnit(`${tokens[i]} ${tokens[i + 1]}`) : null;
                const oneWord = normalizeUnit(tokens[i]);
                if (twoWord && tokens.length > i + 2) {
                    unit = twoWord;
                    i += 2;
                } else if (oneWord && tokens.length > i + 1) {
                    unit = oneWord === 'pc' ? null : oneWord;
                    i++;
                }
            }
            if (tokens[i]?.toLowerCase() === 'of' && tokens.length > i + 1) i++;
        }
    }

    const name = tokens.slice(i).join(' ').trim();
    return { name, quantity, unit, notes, original };
}

/**
 * Split free text into individual items. Newlines, commas and semicolons
 * always separate items; " and " only does when a quantity follows it, so
 * "mac and cheese" and "half and half" stay intact.
 */
export function splitItems(text: string): string[] {
    return text
        .replace(/(\d),(\d)/g, '$1.$2') // "1,5 kg" is a decimal, not two items
        .split(/[\n,;]+/)
        .flatMap(part => part.split(/\s+(?:and|&)\s+(?=(?:\d|[¼½¾⅓⅔]|a |an |one |two |three |four |five |six )\S*)/i))
        .map(cleanLine)
        .filter(Boolean);
}

export function parseItems(text: string): ParsedItem[] {
    return splitItems(text)
        .map(parseItem)
        .filter(item => item.name.length > 0);
}

/** Title-case the first letter while keeping the rest as typed. */
export function displayName(name: string): string {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
