export interface ParsedItem {
    name: string;
    quantity?: number;
    unit?: string;
    original: string;
}

const COMMON_UNITS = [
    'kg', 'g', 'mg', 'lb', 'lbs', 'oz',
    'l', 'ml', 'cl', 'gal', 'qt', 'pt', 'cup', 'cups',
    'tbsp', 'tsp', 'table spoon', 'tea spoon',
    'pc', 'pcs', 'piece', 'pieces', 'pack', 'packs', 'bag', 'bags',
    'box', 'boxes', 'can', 'cans', 'bottle', 'bottles', 'jar', 'jars',
    'bunch', 'bunches', 'head', 'heads', 'loaf', 'loaves', 'dozen'
];

export function parseIngredient(text: string): ParsedItem {
    const cleanText = text.trim();
    if (!cleanText) return { name: '', original: text };

    // Regex to match: starting number (fract/decimal), optional unit, remainder name
    // Examples: "2 cups milk", "1.5 kg rice", "1/2 tsp salt", "milk"

    // ([\d\s/.]+) -> Captures number (integer, decimal, fraction)
    // \s*         -> Optional space
    // ([a-zA-Z]+) -> Captures potential unit
    // \s+         -> Space required if unit exists
    // (.*)        -> Rest is the name

    // Simple approach: Split by space and analyze first 2 tokens
    const parts = cleanText.split(/\s+/);

    let quantity: number | undefined;
    let unit: string | undefined;
    let nameStartIndex = 0;

    // Check first token for number
    if (parts.length > 0) {
        const firstToken = parts[0];
        const numberVal = parseQuantity(firstToken);

        if (numberVal !== undefined) {
            quantity = numberVal;
            nameStartIndex = 1;

            // Check second token for unit
            if (parts.length > 1) {
                const secondToken = parts[1].toLowerCase().replace('.', ''); // remove periods from abbreviations
                // Check if it's a unit or "of"
                if (COMMON_UNITS.includes(secondToken) || secondToken === 'x') {
                    unit = secondToken;
                    nameStartIndex = 2;

                    // Skip "of" if present (e.g. "2 cups of milk")
                    if (parts.length > 2 && parts[2].toLowerCase() === 'of') {
                        nameStartIndex = 3;
                    }
                }
            }
        }
    }

    const name = parts.slice(nameStartIndex).join(' ');

    return {
        name,
        quantity,
        unit,
        original: text
    };
}

function parseQuantity(text: string): number | undefined {
    // Handle "1/2"
    if (text.includes('/')) {
        const [num, den] = text.split('/').map(Number);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
            return num / den;
        }
    }

    // Handle "1.5" or "2"
    const val = parseFloat(text);
    return isNaN(val) ? undefined : val;
}
