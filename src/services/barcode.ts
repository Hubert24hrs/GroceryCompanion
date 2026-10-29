import { Platform } from 'react-native';
import { autoCategorize } from '../domain/categories';
import { BarcodeEntry, Category } from '../domain/types';
import { getDb } from '../data/db';

export class LookupError extends Error {}

export function isValidBarcode(code: string): boolean {
    return /^\d{8,14}$/.test(code.trim());
}

// Open Food Facts category tags → our departments (first match wins).
const TAG_MAP: [RegExp, Category][] = [
    [/frozen/, 'frozen'],
    [/baby/, 'baby'],
    [/pet-food|dog|cat-food/, 'pets'],
    [/beverages|drinks|waters|juices|sodas|coffees|teas|beers|wines/, 'beverages'],
    [/dairies|milks|cheeses|yogurts|butters|eggs/, 'dairy'],
    [/seafood|fishes/, 'seafood'],
    [/meats|poultry|sausages|hams/, 'meat'],
    [/breads|bakery|pastries|viennoiseries/, 'bakery'],
    [/fruits|vegetables|fresh/, 'produce'],
    [/snacks|chips|crisps|biscuits|confectioneries|chocolates|candies|sweet-spreads/, 'snacks'],
    [/hygiene|cosmetics|toothpaste|shampoo/, 'personal_care'],
    [/cleaning|household/, 'household'],
    [/cereals|pastas|rices|groceries|condiments|sauces|spreads|canned|oils|flours|sugars|spices/, 'pantry'],
];

function categoryFromTags(tags: string[] | undefined, name: string): Category {
    for (const [pattern, category] of TAG_MAP) {
        if (tags?.some(t => pattern.test(t))) return category;
    }
    return autoCategorize(name);
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, {
            signal: controller.signal,
            // Browsers forbid setting User-Agent; Open Food Facts asks apps to identify themselves.
            headers: Platform.OS === 'web' ? undefined : { 'User-Agent': 'GroceryCompanion/2.0 (https://github.com/Hubert24hrs/GroceryCompanion)' },
        });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Look a barcode up: the household's own names first (so corrections stick),
 * then Open Food Facts. Returns null when the product is unknown; throws
 * LookupError when offline or the service fails.
 */
export async function lookupBarcode(code: string): Promise<BarcodeEntry | null> {
    const barcode = code.trim();
    if (!isValidBarcode(barcode)) throw new LookupError("That doesn't look like a product barcode.");

    const cached = getDb().get('barcodes', barcode);
    if (cached) return cached;

    let res: Response;
    try {
        res = await fetchWithTimeout(
            `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,generic_name,brands,categories_tags,quantity,image_small_url`,
            8000,
        );
    } catch {
        throw new LookupError("Couldn't reach the product database. Check your connection or enter the name yourself.");
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new LookupError(`Product lookup failed (${res.status}).`);

    const body = await res.json().catch(() => null);
    const product = body?.status === 1 ? body.product : null;
    const name: string | undefined = product?.product_name?.trim() || product?.generic_name?.trim();
    if (!product || !name) return null;

    const entry: BarcodeEntry = {
        id: barcode,
        name,
        brand: product.brands?.split(',')[0]?.trim() || null,
        category: categoryFromTags(product.categories_tags, name),
        quantityLabel: product.quantity || null,
        imageUrl: typeof product.image_small_url === 'string' && product.image_small_url.startsWith('https://') ? product.image_small_url : null,
        source: 'openfoodfacts',
        updatedAt: new Date().toISOString(),
    };
    getDb().putLocal('barcodes', entry);
    return entry;
}

/** Remember a name for an unknown (or wrongly named) barcode on this device. */
export function rememberBarcode(code: string, name: string, category: Category): BarcodeEntry {
    const entry: BarcodeEntry = {
        id: code.trim(),
        name,
        brand: null,
        category,
        quantityLabel: null,
        imageUrl: null,
        source: 'user',
        updatedAt: new Date().toISOString(),
    };
    getDb().putLocal('barcodes', entry);
    return entry;
}
