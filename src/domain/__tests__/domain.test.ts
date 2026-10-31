import { consolidateIngredients, itemsToBuy } from '../aggregate';
import { autoCategorize } from '../categories';
import * as serverDelivery from '../../../functions/src/delivery';
import { DeliveryProvider, isValidPostalCode, itemsForDelivery, providerFor, resolveCountry } from '../delivery';
import { canAddRecipe, canLiveSync, DELIVERY_COUNTRIES, DELIVERY_MODE, FEATURE_ACCESS, FREE_LIMITS, hasFeature } from '../entitlements';
import { planExpiryAlerts } from '../expiryAlerts';
import { defaultPantryLocation, expiryStatus, isLowStock, itemKey } from '../pantry';
import { parseItems, parseNumber } from '../parsing';
import { ListItem, PantryItem, Recipe } from '../types';
import { convert, formatQuantity, unitLabel } from '../units';

describe('units', () => {
    test('word units pluralise above one; fractions and abbreviations do not', () => {
        expect(formatQuantity(2, 'cup')).toBe('2 cups');
        expect(formatQuantity(1.333, 'cup')).toBe('1⅓ cups');
        expect(formatQuantity(0.5, 'cup')).toBe('½ cup');
        expect(formatQuantity(1, 'can')).toBe('1 can');
        expect(formatQuantity(3, 'box')).toBe('3 boxes');
        expect(formatQuantity(2, 'loaf')).toBe('2 loaves');
        expect(formatQuantity(500, 'g')).toBe('500 g');
        expect(formatQuantity(2, 'lb')).toBe('2 lb');
        expect(formatQuantity(6, null)).toBe('6');
        expect(unitLabel('tbsp', 4)).toBe('tbsp');
    });

    test('converts within a family only', () => {
        expect(convert(1, 'kg', 'g')).toBe(1000);
        expect(convert(1, 'dozen', null)).toBe(12);
        expect(convert(1, 'cup', 'g')).toBeNull();
    });
});

describe('parsing', () => {
    test('splits and parses a quick-add line', () => {
        const items = parseItems('2 lb chicken breast, milk, 6 eggs');
        expect(items.map(i => [i.name, i.quantity, i.unit])).toEqual([
            ['chicken breast', 2, 'lb'],
            ['milk', null, null],
            ['eggs', 6, null],
        ]);
    });

    test('keeps "and" inside names', () => {
        expect(parseItems('mac and cheese').map(i => i.name)).toEqual(['mac and cheese']);
    });

    test('reads fractions', () => {
        expect(parseNumber('½')).toBe(0.5);
        expect(parseNumber('1/4')).toBe(0.25);
        expect(parseNumber('1½')).toBe(1.5);
    });
});

describe('categories', () => {
    test('picks the longest keyword, not the first', () => {
        expect(autoCategorize('ice cream')).toBe('frozen');
        expect(autoCategorize('bananas')).toBe('produce');
    });
});

describe('pantry', () => {
    const item = (extra: Partial<PantryItem>): PantryItem => ({
        id: 'p',
        householdId: 'h',
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
        name: 'Milk',
        category: 'dairy',
        quantity: 2,
        unit: null,
        lowStockThreshold: null,
        expiresOn: null,
        location: 'fridge',
        barcode: null,
        notes: null,
        ...extra,
    });

    test('one default location for hand-added and restocked items', () => {
        expect(defaultPantryLocation('produce')).toBe('fridge');
        expect(defaultPantryLocation('dairy')).toBe('fridge');
        expect(defaultPantryLocation('frozen')).toBe('freezer');
        expect(defaultPantryLocation('pantry')).toBe('pantry');
        expect(defaultPantryLocation('household')).toBe('pantry');
    });

    test('low stock and expiry', () => {
        expect(isLowStock(item({ quantity: 0 }))).toBe(true);
        expect(isLowStock(item({ quantity: 1, lowStockThreshold: 1 }))).toBe(true);
        expect(isLowStock(item({ quantity: 3, lowStockThreshold: 1 }))).toBe(false);
        expect(expiryStatus(item({ expiresOn: '2026-10-28' }), '2026-10-29')).toBe('expired');
        expect(expiryStatus(item({ expiresOn: '2026-10-31' }), '2026-10-29')).toBe('soon');
        expect(expiryStatus(item({ expiresOn: '2026-12-01' }), '2026-10-29')).toBe('ok');
    });

    test('item keys ignore case and plurals', () => {
        expect(itemKey('Bananas')).toBe(itemKey('banana'));
    });
});

describe('ingredient consolidation', () => {
    const recipe = (id: string, servings: number, ingredients: Recipe['ingredients']): Recipe => ({
        id,
        householdId: 'h',
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
        title: id,
        description: null,
        imageUrl: null,
        sourceName: null,
        sourceUrl: null,
        prepMinutes: null,
        cookMinutes: null,
        servings,
        calories: null,
        ingredients,
        instructions: [],
        tags: [],
        collection: null,
        isFavorite: false,
        estimatedCost: null,
    });

    test('scales by servings and merges compatible units across recipes', () => {
        const a = recipe('Pancakes', 2, [{ name: 'Milk', quantity: 1, unit: 'cup', category: 'dairy' }]);
        const b = recipe('Smoothie', 1, [{ name: 'milk', quantity: 250, unit: 'ml', category: 'dairy' }]);
        const [milk] = consolidateIngredients([
            { recipe: a, servings: 4 },
            { recipe: b, servings: 1 },
        ]);
        // 2 cups (scaled) + 250 ml ≈ 3.06 cups
        expect(milk.unit).toBe('cup');
        expect(milk.quantity).toBeCloseTo(3.06, 1);
        expect(milk.sources).toEqual(['Pancakes', 'Smoothie']);
    });

    test('pantry stock is subtracted and covered lines are not bought', () => {
        const r = recipe('Toast', 1, [
            { name: 'Bread', quantity: 2, unit: null, category: 'bakery' },
            { name: 'Butter', quantity: 1, unit: 'tbsp', category: 'dairy' },
        ]);
        const pantry = [{ name: 'butter', deletedAt: null, quantity: 10, unit: 'tbsp' }] as PantryItem[];
        const lines = consolidateIngredients([{ recipe: r, servings: 1 }], pantry);
        expect(lines.find(l => l.name === 'Butter')?.status).toBe('in-pantry');
        expect(itemsToBuy(lines).map(l => l.name)).toEqual(['Bread']);
    });

    test('ingredients already on the list are not bought twice', () => {
        const r = recipe('Toast', 1, [
            { name: 'Bread', quantity: 2, unit: null, category: 'bakery' },
            { name: 'Jam', quantity: 1, unit: null, category: 'pantry' },
        ]);
        const onList = [{ name: 'breads', deletedAt: null, isChecked: false, quantity: 2, unit: null }] as ListItem[];
        const lines = consolidateIngredients([{ recipe: r, servings: 1 }], [], onList);
        expect(lines.find(l => l.name === 'Bread')?.status).toBe('on-list');
        expect(itemsToBuy(lines).map(l => l.name)).toEqual(['Jam']);
    });
});

describe('entitlements', () => {
    test('live sync needs your own Pro or the household owner', () => {
        expect(canLiveSync(false, false)).toBe(false);
        expect(canLiveSync(true, false)).toBe(true);
        expect(canLiveSync(false, true)).toBe(true);
    });

    test('recipe to list is free, with the recipe cap', () => {
        expect(hasFeature(false, 'recipeToList')).toBe(true);
        expect(canAddRecipe(false, FREE_LIMITS.recipes - 1)).toBe(true);
        expect(canAddRecipe(false, FREE_LIMITS.recipes)).toBe(false);
        expect(canAddRecipe(true, FREE_LIMITS.recipes)).toBe(true);
    });

    test('the new features need Pro', () => {
        for (const feature of ['liveSync', 'pantryAlerts', 'delivery'] as const) {
            expect(FEATURE_ACCESS[feature]).toBe('pro');
            expect(hasFeature(false, feature)).toBe(false);
            expect(hasFeature(true, feature)).toBe(true);
        }
    });
});

describe('expiry alerts', () => {
    const milk = { name: 'Milk', quantity: 1, expiresOn: '2026-11-10', deletedAt: null };

    test('fire the chosen number of days before expiry', () => {
        expect(planExpiryAlerts([milk], '2026-11-01', 2, 12)).toEqual([{ date: '2026-11-08', title: 'Use it soon', body: 'Milk expires in 2 days.' }]);
        expect(planExpiryAlerts([milk], '2026-11-01', 5, 12)[0].date).toBe('2026-11-05');
    });

    test('items already inside the window fire at the next morning', () => {
        expect(planExpiryAlerts([milk], '2026-11-09', 2, 8)[0]).toMatchObject({ date: '2026-11-09', body: 'Milk expires tomorrow.' });
        expect(planExpiryAlerts([milk], '2026-11-09', 2, 12)[0]).toMatchObject({ date: '2026-11-10', body: 'Milk expires today.' });
    });

    test('nothing for expired, undated, used-up or deleted items', () => {
        expect(planExpiryAlerts([milk], '2026-11-10', 2, 12)).toEqual([]);
        expect(planExpiryAlerts([{ ...milk, expiresOn: null }], '2026-11-01', 2, 12)).toEqual([]);
        expect(planExpiryAlerts([{ ...milk, quantity: 0 }], '2026-11-01', 2, 12)).toEqual([]);
        expect(planExpiryAlerts([{ ...milk, deletedAt: '2026-11-01' }], '2026-11-01', 2, 12)).toEqual([]);
    });

    test('a day with several items sends one alert', () => {
        const items = ['Eggs', 'Ham', 'Kale', 'Yogurt'].map(name => ({ ...milk, name }));
        expect(planExpiryAlerts(items, '2026-11-01', 2, 12)).toEqual([
            { date: '2026-11-08', title: '4 pantry items expire soon', body: 'Eggs, Ham, Kale and 1 more. The first expires in 2 days.' },
        ]);
    });
});

describe('delivery', () => {
    const provider = { id: 'instacart', supportedCountries: DELIVERY_COUNTRIES } as DeliveryProvider;

    test('is off unless a build turns it on', () => {
        expect(DELIVERY_MODE).toBe('off');
        expect(providerFor([provider], 'off', 'US')).toBeNull();
    });

    test('shows in the US and Canada, and nowhere else', () => {
        expect(providerFor([provider], 'live', 'US')).toBe(provider);
        expect(providerFor([provider], 'mock', 'CA')).toBe(provider);
        for (const country of ['NG', 'GB', 'DE', 'FR', 'OTHER', null]) expect(providerFor([provider], 'live', country)).toBeNull();
    });

    test('the Settings choice beats the phone region', () => {
        expect(resolveCountry(null, 'US')).toBe('US');
        expect(resolveCountry('OTHER', 'US')).toBe('OTHER');
        expect(resolveCountry('CA', 'NG')).toBe('CA');
        expect(resolveCountry(null, null)).toBeNull();
    });

    test('validates postal codes per country', () => {
        for (const ok of ['94105', '94105-1234']) expect(isValidPostalCode('US', ok)).toBe(true);
        for (const ok of ['K1A 0B1', 'k1a0b1', 'K1A-0B1', ' K1A 0B1 ']) expect(isValidPostalCode('CA', ok)).toBe(true);
        for (const bad of ['9410', '941055', '94105-12', 'K1A 0B1', '']) expect(isValidPostalCode('US', bad)).toBe(false);
        for (const bad of ['94105', 'K1A0B', 'KKA 0B1', '']) expect(isValidPostalCode('CA', bad)).toBe(false);
        expect(isValidPostalCode('NG', '100001')).toBe(false);
    });

    test('the app and the server agree', () => {
        expect(serverDelivery.DELIVERY_COUNTRIES).toEqual(DELIVERY_COUNTRIES);
        expect(serverDelivery.DELIVERY_REQUIRES_PRO).toBe(FEATURE_ACCESS.delivery === 'pro');
        for (const code of ['94105', '94105-1234', 'K1A 0B1', 'k1a0b1', '9410', 'nope']) {
            for (const country of ['US', 'CA', 'NG']) expect(serverDelivery.isValidPostalCode(country, code)).toBe(isValidPostalCode(country, code));
        }
    });

    test('sends only what is left to buy, and only its name and amount', () => {
        const base = { id: 'x', name: 'Milk', quantity: 2, unit: 'l', isChecked: false, deletedAt: null, notes: 'For Sam', householdId: 'h' };
        const items = [base, { ...base, name: 'Eggs', isChecked: true }, { ...base, name: 'Ham', deletedAt: 'now' }] as ListItem[];
        expect(itemsForDelivery(items)).toEqual([{ name: 'Milk', quantity: 2, unit: 'l' }]);
    });
});
