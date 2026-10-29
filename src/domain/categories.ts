import { Category } from './types';

export interface CategoryInfo {
    label: string;
    /** MaterialCommunityIcons glyph name. */
    icon: string;
    color: string;
    /** Typical walking order through a supermarket. */
    aisleOrder: number;
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
    produce: { label: 'Produce', icon: 'food-apple', color: '#3E9B4F', aisleOrder: 1 },
    bakery: { label: 'Bakery', icon: 'baguette', color: '#C98A3D', aisleOrder: 2 },
    meat: { label: 'Meat', icon: 'food-steak', color: '#C2453D', aisleOrder: 3 },
    seafood: { label: 'Seafood', icon: 'fish', color: '#2F7FB5', aisleOrder: 4 },
    dairy: { label: 'Dairy & Eggs', icon: 'cheese', color: '#D9A520', aisleOrder: 5 },
    frozen: { label: 'Frozen', icon: 'snowflake', color: '#3AA6C9', aisleOrder: 6 },
    pantry: { label: 'Pantry Staples', icon: 'pasta', color: '#9A6B3F', aisleOrder: 7 },
    snacks: { label: 'Snacks', icon: 'cookie', color: '#D9773A', aisleOrder: 8 },
    beverages: { label: 'Beverages', icon: 'cup', color: '#6B7FD1', aisleOrder: 9 },
    household: { label: 'Household', icon: 'spray-bottle', color: '#8A5BC2', aisleOrder: 10 },
    personal_care: { label: 'Health & Personal Care', icon: 'lotion-plus', color: '#D2558A', aisleOrder: 11 },
    baby: { label: 'Baby', icon: 'baby-bottle-outline', color: '#E08AA8', aisleOrder: 12 },
    pets: { label: 'Pets', icon: 'paw', color: '#7D6B5D', aisleOrder: 13 },
    other: { label: 'Other', icon: 'tag-outline', color: '#7A867E', aisleOrder: 99 },
};

export const CATEGORY_LIST = (Object.keys(CATEGORIES) as Category[]).sort(
    (a, b) => CATEGORIES[a].aisleOrder - CATEGORIES[b].aisleOrder,
);

export function isCategory(value: unknown): value is Category {
    return typeof value === 'string' && value in CATEGORIES;
}

const KEYWORDS: Record<Exclude<Category, 'other'>, string[]> = {
    produce: [
        'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberr', 'blueberr', 'raspberr', 'blackberr',
        'lettuce', 'spinach', 'kale', 'arugula', 'cabbage', 'broccoli', 'cauliflower', 'asparagus', 'tomato',
        'onion', 'garlic', 'ginger', 'potato', 'sweet potato', 'carrot', 'celery', 'cucumber', 'bell pepper',
        'pepper', 'jalapeño', 'jalapeno', 'mushroom', 'avocado', 'mango', 'pineapple', 'watermelon', 'melon',
        'cantaloupe', 'peach', 'plum', 'pear', 'cherr', 'kiwi', 'zucchini', 'squash', 'eggplant', 'corn',
        'green beans', 'peas', 'basil', 'cilantro', 'parsley', 'mint', 'dill', 'salad', 'greens', 'romaine',
        'scallion', 'shallot', 'leek', 'beet', 'radish', 'herbs', 'fruit', 'vegetable', 'veggie', 'plantain',
        'yam', 'okra', 'coconut',
    ],
    bakery: [
        'bread', 'sourdough', 'baguette', 'ciabatta', 'focaccia', 'bagel', 'english muffin', 'muffin',
        'croissant', 'donut', 'doughnut', 'pastry', 'danish', 'cake', 'cupcake', 'pie', 'tart', 'roll', 'buns',
        'tortilla', 'pita', 'naan', 'flatbread', 'wrap', 'brioche',
    ],
    meat: [
        'chicken', 'beef', 'steak', 'ribeye', 'sirloin', 'brisket', 'pork', 'bacon', 'ham', 'sausage', 'hot dog',
        'bratwurst', 'turkey', 'lamb', 'veal', 'deli meat', 'lunch meat', 'salami', 'pepperoni', 'prosciutto',
        'ground meat', 'meatball', 'chorizo', 'goat meat',
    ],
    seafood: [
        'fish', 'salmon', 'tuna steak', 'tilapia', 'cod', 'halibut', 'trout', 'mahi', 'shrimp', 'prawn', 'crab',
        'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'seafood', 'catfish', 'mackerel', 'sardine fillet',
    ],
    dairy: [
        'milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'swiss', 'provolone', 'feta', 'brie', 'ricotta',
        'yogurt', 'yoghurt', 'cottage cheese', 'sour cream', 'butter', 'margarine', 'egg', 'heavy cream',
        'whipping cream', 'half and half', 'creamer', 'kefir', 'ghee',
    ],
    frozen: [
        'frozen', 'ice cream', 'gelato', 'popsicle', 'sorbet', 'french fries', 'tater tots', 'tv dinner',
        'hot pocket', 'pizza rolls', 'ice pop', 'ice',
    ],
    pantry: [
        'rice', 'pasta', 'spaghetti', 'penne', 'macaroni', 'linguine', 'fettuccine', 'noodle', 'ramen', 'cereal',
        'oatmeal', 'oats', 'granola', 'soup', 'broth', 'stock', 'beans', 'chickpea', 'lentil', 'canned',
        'tomato sauce', 'tomato paste', 'salsa', 'marinara', 'oil', 'cooking spray', 'flour', 'sugar', 'salt',
        'black pepper', 'spice', 'seasoning', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'peanut butter',
        'almond butter', 'jelly', 'jam', 'honey', 'maple syrup', 'syrup', 'nutella', 'ketchup', 'mustard',
        'mayonnaise', 'mayo', 'ranch', 'dressing', 'bbq sauce', 'soy sauce', 'hot sauce', 'vinegar', 'balsamic',
        'tuna', 'spam', 'sardines', 'anchovies', 'baking powder', 'baking soda', 'yeast', 'vanilla', 'cocoa',
        'quinoa', 'couscous', 'breadcrumbs', 'croutons', 'stock cube', 'bouillon', 'curry', 'coconut milk',
    ],
    snacks: [
        'chips', 'crisps', 'crackers', 'pretzels', 'popcorn', 'nuts', 'almonds', 'peanuts', 'cashews', 'chocolate',
        'candy', 'snack', 'protein bar', 'granola bar', 'dried fruit', 'raisins', 'cookies', 'biscuits', 'gum',
        'trail mix', 'jerky',
    ],
    beverages: [
        'coffee', 'tea', 'juice', 'soda', 'water', 'sparkling', 'energy drink', 'beer', 'wine', 'liquor', 'vodka',
        'whiskey', 'gin', 'rum', 'tequila', 'cola', 'coke', 'pepsi', 'sprite', 'lemonade', 'kombucha',
        'sports drink', 'gatorade', 'smoothie',
    ],
    household: [
        'paper towel', 'toilet paper', 'tissue', 'napkin', 'trash bag', 'garbage bag', 'ziploc', 'zip lock',
        'aluminum foil', 'foil', 'plastic wrap', 'parchment', 'wax paper', 'dish soap', 'dishwasher', 'detergent',
        'fabric softener', 'dryer sheets', 'bleach', 'stain remover', 'cleaner', 'windex', 'lysol', 'clorox',
        'disinfectant', 'wipes', 'sponge', 'scrub', 'mop', 'broom', 'light bulb', 'batteries', 'matches',
        'candles', 'air freshener', 'freezer bags', 'sandwich bags',
    ],
    personal_care: [
        'shampoo', 'conditioner', 'body wash', 'soap', 'toothpaste', 'toothbrush', 'mouthwash', 'floss',
        'deodorant', 'perfume', 'cologne', 'lotion', 'moisturizer', 'sunscreen', 'razor', 'shaving', 'makeup',
        'mascara', 'lipstick', 'nail polish', 'cotton', 'q tips', 'band-aid', 'bandaid', 'bandage', 'first aid',
        'medicine', 'advil', 'tylenol', 'ibuprofen', 'paracetamol', 'vitamin', 'supplement', 'tampon', 'pads',
    ],
    baby: ['diaper', 'nappy', 'baby wipes', 'baby formula', 'formula', 'baby food', 'baby lotion', 'pacifier'],
    pets: ['dog food', 'cat food', 'pet food', 'cat litter', 'litter', 'pet treats', 'dog treats', 'kibble'],
};

// Flattened (keyword, category) pairs sorted longest-first so specific phrases
// ("peanut butter", "ice cream", "coconut milk") beat their substrings.
const KEYWORD_INDEX: { keyword: string; category: Category }[] = (
    Object.entries(KEYWORDS) as [Category, string[]][]
)
    .flatMap(([category, words]) => words.map(keyword => ({ keyword, category })))
    .sort((a, b) => b.keyword.length - a.keyword.length);

function normalize(text: string): string {
    return text.toLowerCase().replace(/[^\p{L}\p{N}%\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Index of `keyword` in `haystack` starting at a word boundary, or -1. */
function findWord(haystack: string, keyword: string): number {
    let idx = haystack.indexOf(keyword);
    while (idx >= 0) {
        // "ice" must not match "rice" or "juice".
        if (idx === 0 || haystack[idx - 1] === ' ') return idx;
        idx = haystack.indexOf(keyword, idx + 1);
    }
    return -1;
}

/**
 * Pick the most likely store department for an item name.
 *
 * English grocery names put the head noun last ("chicken broth" is broth,
 * "chocolate milk" is milk), so a keyword reaching the final word beats one
 * that doesn't; ties go to the longest keyword. "frozen …" always means Frozen.
 */
export function autoCategorize(itemName: string): Category {
    const text = normalize(itemName);
    if (!text) return 'other';
    if (text.startsWith('frozen ')) return 'frozen';

    const lastWordStart = text.lastIndexOf(' ') + 1;
    let best: { category: Category; score: number } | null = null;
    for (const { keyword, category } of KEYWORD_INDEX) {
        const idx = findWord(text, keyword);
        if (idx < 0) continue;
        const reachesHead = idx + keyword.length > lastWordStart;
        const score = (reachesHead ? 1000 : 0) + keyword.length;
        if (!best || score > best.score) best = { category, score };
    }
    return best?.category ?? 'other';
}

/** Category order used when grouping a list: by aisle, 'other' last. */
export function compareCategories(a: Category, b: Category): number {
    return CATEGORIES[a].aisleOrder - CATEGORIES[b].aisleOrder;
}
