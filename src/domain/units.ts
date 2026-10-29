// Unit normalization and conversion for combining ingredient quantities.

const ALIASES: Record<string, string> = {
    lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
    oz: 'oz', ounce: 'oz', ounces: 'oz',
    g: 'g', gr: 'g', gram: 'g', grams: 'g',
    kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
    mg: 'mg',
    ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
    l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
    cl: 'cl',
    tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
    tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
    cup: 'cup', cups: 'cup',
    'fl oz': 'fl oz', floz: 'fl oz',
    pt: 'pt', pint: 'pt', pints: 'pt',
    qt: 'qt', quart: 'qt', quarts: 'qt',
    gal: 'gal', gallon: 'gal', gallons: 'gal',
    pc: 'pc', pcs: 'pc', piece: 'pc', pieces: 'pc', x: 'pc', ea: 'pc', each: 'pc',
    pack: 'pack', packs: 'pack', pk: 'pack', package: 'pack', packages: 'pack',
    bag: 'bag', bags: 'bag',
    box: 'box', boxes: 'box',
    can: 'can', cans: 'can', tin: 'can', tins: 'can',
    bottle: 'bottle', bottles: 'bottle',
    jar: 'jar', jars: 'jar',
    carton: 'carton', cartons: 'carton',
    bunch: 'bunch', bunches: 'bunch',
    head: 'head', heads: 'head',
    loaf: 'loaf', loaves: 'loaf',
    dozen: 'dozen', doz: 'dozen',
    clove: 'clove', cloves: 'clove',
    slice: 'slice', slices: 'slice',
    stick: 'stick', sticks: 'stick',
    roll: 'roll', rolls: 'roll',
};

export const COMMON_UNITS = ['pc', 'lb', 'oz', 'kg', 'g', 'l', 'ml', 'cup', 'pack', 'bag', 'box', 'can', 'bottle', 'jar', 'carton', 'bunch', 'dozen', 'gal'];

/** Canonical unit for a token, or null if it isn't a unit. */
export function normalizeUnit(token: string | null | undefined): string | null {
    if (!token) return null;
    const key = token.toLowerCase().replace(/\.$/, '').trim();
    return ALIASES[key] ?? null;
}

type Family = 'mass' | 'volume' | 'count';

// Factor to the family's base unit (g, ml, piece).
const FACTORS: Record<string, { family: Family; factor: number }> = {
    mg: { family: 'mass', factor: 0.001 },
    g: { family: 'mass', factor: 1 },
    kg: { family: 'mass', factor: 1000 },
    oz: { family: 'mass', factor: 28.3495 },
    lb: { family: 'mass', factor: 453.592 },
    ml: { family: 'volume', factor: 1 },
    cl: { family: 'volume', factor: 10 },
    l: { family: 'volume', factor: 1000 },
    tsp: { family: 'volume', factor: 4.92892 },
    tbsp: { family: 'volume', factor: 14.7868 },
    'fl oz': { family: 'volume', factor: 29.5735 },
    cup: { family: 'volume', factor: 236.588 },
    pt: { family: 'volume', factor: 473.176 },
    qt: { family: 'volume', factor: 946.353 },
    gal: { family: 'volume', factor: 3785.41 },
    pc: { family: 'count', factor: 1 },
    dozen: { family: 'count', factor: 12 },
};

function info(unit: string | null) {
    // A missing unit means "pieces".
    return FACTORS[unit ?? 'pc'] ?? null;
}

/** Convert `quantity` from one unit to another; null when not convertible. */
export function convert(quantity: number, from: string | null, to: string | null): number | null {
    if ((from ?? 'pc') === (to ?? 'pc')) return quantity;
    const a = info(from);
    const b = info(to);
    if (!a || !b || a.family !== b.family) return null;
    return (quantity * a.factor) / b.factor;
}

export function areCompatible(a: string | null, b: string | null): boolean {
    return convert(1, a, b) !== null;
}

/** Round to a friendly precision for display and storage. */
export function roundQuantity(value: number): number {
    if (value >= 10) return Math.round(value * 10) / 10;
    return Math.round(value * 100) / 100;
}

const FRACTIONS: [number, string][] = [[0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾']];

// Word units take a plural; abbreviations (g, lb, tbsp, fl oz…) never do.
const PLURALS: Record<string, string> = {
    cup: 'cups', pack: 'packs', bag: 'bags', box: 'boxes', can: 'cans', bottle: 'bottles', jar: 'jars',
    carton: 'cartons', bunch: 'bunches', head: 'heads', loaf: 'loaves', clove: 'cloves', slice: 'slices',
    stick: 'sticks', roll: 'rolls',
};

/** "cup" → "cups" for quantities above one; fractions and 1 stay singular ("½ cup"). */
export function unitLabel(unit: string, quantity: number | null | undefined): string {
    return quantity != null && quantity > 1 && PLURALS[unit] ? PLURALS[unit] : unit;
}

export function formatQuantity(quantity: number | null | undefined, unit?: string | null): string {
    if (quantity == null) return unit ?? '';
    const whole = Math.floor(quantity);
    const frac = quantity - whole;
    let text = String(roundQuantity(quantity));
    const match = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.02);
    if (match && quantity < 20) text = `${whole > 0 ? whole : ''}${match[1]}`;
    if (!unit || unit === 'pc') return text;
    return `${text} ${unitLabel(unit, quantity)}`;
}
