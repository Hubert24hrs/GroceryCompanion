
const COMMON_UNITS = [
    'kg', 'g', 'mg', 'lb', 'lbs', 'oz',
    'l', 'ml', 'cl', 'gal', 'qt', 'pt', 'cup', 'cups',
    'tbsp', 'tsp', 'table spoon', 'tea spoon',
    'pc', 'pcs', 'piece', 'pieces', 'pack', 'packs', 'bag', 'bags',
    'box', 'boxes', 'can', 'cans', 'bottle', 'bottles', 'jar', 'jars',
    'bunch', 'bunches', 'head', 'heads', 'loaf', 'loaves', 'dozen'
];

function parseIngredient(text) {
    const cleanText = text.trim();
    if (!cleanText) return { name: '', original: text };

    const parts = cleanText.split(/\s+/);

    let quantity;
    let unit;
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
                const secondToken = parts[1].toLowerCase().replace('.', '');
                // Check if it's a unit or "of"
                if (COMMON_UNITS.includes(secondToken) || secondToken === 'x') {
                    unit = secondToken;
                    nameStartIndex = 2;

                    // Skip "of" if present
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

function parseQuantity(text) {
    if (text.includes('/')) {
        const [num, den] = text.split('/').map(Number);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
            return num / den;
        }
    }

    const val = parseFloat(text);
    return isNaN(val) ? undefined : val;
}

// Test Cases
const testCases = [
    "2 cups milk",
    "1 dozen eggs",
    "Bread",
    "1.5 kg rice",
    "1/2 tsp salt",
    "Chicken breast",
    "3 cans of beans",
    "0.5 liters water",
    "5 apples"
];

console.log("Running Parsing Tests...\n");

testCases.forEach(test => {
    const result = parseIngredient(test);
    console.log(`Input: "${test}"`);
    console.log(`Parsed: Quantity=${result.quantity}, Unit=${result.unit}, Name="${result.name}"`);
    console.log('---');
});
