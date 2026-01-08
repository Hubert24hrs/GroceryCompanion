import { Category } from '../../types/index';

// Keyword mappings for automatic item categorization
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
    produce: [
        'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'lemon', 'lemons', 'lime', 'limes',
        'grape', 'grapes', 'strawberry', 'strawberries', 'blueberry', 'blueberries', 'raspberry', 'raspberries',
        'lettuce', 'spinach', 'kale', 'arugula', 'cabbage', 'broccoli', 'cauliflower', 'asparagus',
        'tomato', 'tomatoes', 'onion', 'onions', 'garlic', 'ginger', 'potato', 'potatoes', 'sweet potato',
        'carrot', 'carrots', 'celery', 'cucumber', 'bell pepper', 'peppers', 'jalapeño', 'mushroom', 'mushrooms',
        'avocado', 'avocados', 'mango', 'mangoes', 'pineapple', 'watermelon', 'cantaloupe', 'honeydew',
        'peach', 'peaches', 'plum', 'plums', 'pear', 'pears', 'cherry', 'cherries', 'kiwi',
        'zucchini', 'squash', 'eggplant', 'corn', 'green beans', 'peas', 'herbs', 'basil', 'cilantro', 'parsley',
        'salad', 'greens', 'romaine', 'iceberg', 'mixed greens', 'coleslaw', 'fruit', 'vegetables', 'veggies'
    ],
    dairy: [
        'milk', '2% milk', 'whole milk', 'skim milk', 'oat milk', 'almond milk', 'soy milk', 'coconut milk',
        'cheese', 'cheddar', 'mozzarella', 'parmesan', 'swiss', 'provolone', 'american cheese', 'cream cheese',
        'yogurt', 'greek yogurt', 'cottage cheese', 'sour cream', 'butter', 'margarine',
        'eggs', 'egg', 'egg whites', 'heavy cream', 'whipping cream', 'half and half', 'creamer',
        'ice cream', 'frozen yogurt', 'gelato'
    ],
    meat: [
        'chicken', 'chicken breast', 'chicken thighs', 'chicken wings', 'whole chicken', 'rotisserie chicken',
        'beef', 'ground beef', 'steak', 'ribeye', 'sirloin', 'filet', 'roast', 'brisket',
        'pork', 'pork chops', 'bacon', 'ham', 'sausage', 'hot dogs', 'bratwurst', 'pork loin',
        'turkey', 'ground turkey', 'turkey breast', 'deli turkey', 'lamb', 'lamb chops',
        'fish', 'salmon', 'tuna', 'tilapia', 'cod', 'halibut', 'trout', 'mahi mahi',
        'shrimp', 'crab', 'lobster', 'scallops', 'clams', 'mussels', 'oysters', 'seafood',
        'deli meat', 'lunch meat', 'salami', 'pepperoni', 'prosciutto'
    ],
    bakery: [
        'bread', 'white bread', 'wheat bread', 'sourdough', 'baguette', 'ciabatta', 'focaccia',
        'bagel', 'bagels', 'english muffin', 'muffin', 'muffins', 'croissant', 'croissants',
        'donut', 'donuts', 'doughnut', 'doughnuts', 'pastry', 'pastries', 'danish',
        'cake', 'cupcake', 'cupcakes', 'pie', 'tart', 'cookie', 'cookies', 'brownie', 'brownies',
        'roll', 'rolls', 'dinner rolls', 'buns', 'hamburger buns', 'hot dog buns',
        'tortilla', 'tortillas', 'pita', 'naan', 'flatbread', 'wrap', 'wraps'
    ],
    frozen: [
        'frozen pizza', 'frozen vegetables', 'frozen fruit', 'frozen berries', 'frozen meals',
        'frozen dinner', 'frozen breakfast', 'frozen waffles', 'frozen pancakes',
        'ice cream', 'popsicle', 'popsicles', 'frozen treats', 'frozen yogurt',
        'frozen chicken', 'frozen fish', 'frozen shrimp', 'frozen meat',
        'frozen fries', 'french fries', 'tater tots', 'frozen potatoes',
        'tv dinner', 'lean cuisine', 'hot pocket', 'pizza rolls', 'egg rolls',
        'frozen pie', 'frozen dessert', 'frozen bread', 'frozen dough'
    ],
    pantry: [
        'rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice',
        'pasta', 'spaghetti', 'penne', 'macaroni', 'linguine', 'fettuccine', 'noodles', 'ramen',
        'cereal', 'oatmeal', 'oats', 'granola', 'breakfast bar',
        'soup', 'canned soup', 'broth', 'stock', 'chicken broth', 'beef broth',
        'canned beans', 'black beans', 'kidney beans', 'chickpeas', 'lentils',
        'canned tomatoes', 'tomato sauce', 'tomato paste', 'salsa', 'marinara',
        'oil', 'olive oil', 'vegetable oil', 'coconut oil', 'cooking spray',
        'flour', 'all purpose flour', 'whole wheat flour', 'sugar', 'brown sugar', 'powdered sugar',
        'salt', 'pepper', 'spices', 'seasoning', 'cumin', 'paprika', 'oregano', 'basil', 'thyme',
        'peanut butter', 'almond butter', 'jelly', 'jam', 'honey', 'maple syrup', 'nutella',
        'ketchup', 'mustard', 'mayonnaise', 'ranch', 'dressing', 'bbq sauce', 'soy sauce', 'hot sauce',
        'vinegar', 'balsamic', 'apple cider vinegar', 'wine vinegar',
        'coffee', 'tea', 'juice', 'soda', 'water', 'sparkling water', 'energy drink',
        'chips', 'crackers', 'pretzels', 'popcorn', 'nuts', 'almonds', 'peanuts', 'cashews',
        'chocolate', 'candy', 'snacks', 'protein bar', 'dried fruit', 'raisins',
        'canned tuna', 'canned chicken', 'spam', 'sardines', 'anchovies'
    ],
    household: [
        'paper towel', 'paper towels', 'toilet paper', 'tissue', 'tissues', 'napkins',
        'trash bag', 'trash bags', 'garbage bags', 'zip lock', 'ziploc', 'plastic bags',
        'aluminum foil', 'tin foil', 'plastic wrap', 'saran wrap', 'parchment paper', 'wax paper',
        'dish soap', 'dishwasher detergent', 'dishwasher pods', 'dawn',
        'laundry detergent', 'fabric softener', 'dryer sheets', 'bleach', 'stain remover',
        'all purpose cleaner', 'windex', 'lysol', 'clorox', 'disinfectant', 'cleaning wipes',
        'sponge', 'sponges', 'scrub brush', 'steel wool', 'dish brush',
        'mop', 'broom', 'dustpan', 'vacuum bags', 'duster',
        'light bulb', 'batteries', 'matches', 'candles', 'air freshener',
        'pet food', 'dog food', 'cat food', 'cat litter', 'pet treats'
    ],
    personal_care: [
        'shampoo', 'conditioner', 'body wash', 'soap', 'bar soap', 'hand soap',
        'toothpaste', 'toothbrush', 'mouthwash', 'floss', 'dental',
        'deodorant', 'antiperspirant', 'perfume', 'cologne', 'body spray',
        'lotion', 'body lotion', 'moisturizer', 'sunscreen', 'sunblock',
        'razor', 'razors', 'shaving cream', 'shaving gel', 'aftershave',
        'makeup', 'mascara', 'lipstick', 'foundation', 'concealer', 'eyeshadow',
        'nail polish', 'nail polish remover', 'cotton balls', 'cotton swabs', 'q tips',
        'bandaid', 'bandaids', 'band-aid', 'first aid', 'medicine', 'advil', 'tylenol', 'ibuprofen',
        'vitamins', 'supplements', 'multivitamin', 'fish oil', 'probiotics',
        'feminine products', 'tampons', 'pads', 'panty liners',
        'diapers', 'baby wipes', 'baby formula', 'baby food', 'baby lotion'
    ],
    other: [],
};

/**
 * Automatically categorize an item based on its name
 * Returns the best matching category or 'other' if no match found
 */
export function autoCategorize(itemName: string): Category {
    const normalized = itemName.toLowerCase().trim();

    // Check each category for matching keywords
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (category === 'other') continue;

        // Check for exact match first
        if (keywords.includes(normalized)) {
            return category as Category;
        }

        // Check if any keyword is contained in the item name
        for (const keyword of keywords) {
            if (normalized.includes(keyword) || keyword.includes(normalized)) {
                return category as Category;
            }
        }
    }

    return 'other';
}

/**
 * Get category suggestions for autocomplete
 * Returns categories sorted by relevance
 */
export function getCategorySuggestions(itemName: string): Category[] {
    const normalized = itemName.toLowerCase().trim();
    const matches: { category: Category; score: number }[] = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (category === 'other') continue;

        let score = 0;
        for (const keyword of keywords) {
            if (normalized.includes(keyword)) {
                score += keyword.length; // Longer matches score higher
            }
        }

        if (score > 0) {
            matches.push({ category: category as Category, score });
        }
    }

    return matches
        .sort((a, b) => b.score - a.score)
        .map(m => m.category);
}
