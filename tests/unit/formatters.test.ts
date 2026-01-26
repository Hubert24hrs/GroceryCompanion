import { toSnakeCase } from '../../src/utils/formatters';

describe('toSnakeCase', () => {
    it('converts camelCase keys to snake_case', () => {
        const input = {
            firstName: 'John',
            lastName: 'Doe',
            isProUser: true,
        };
        const expected = {
            first_name: 'John',
            last_name: 'Doe',
            is_pro_user: true,
        };
        expect(toSnakeCase(input)).toEqual(expected);
    });

    it('handles nested objects', () => {
        const input = {
            userProfile: {
                displayName: 'Jane',
                addressInfo: {
                    streetName: 'Main St',
                },
            },
        };
        const expected = {
            user_profile: {
                display_name: 'Jane',
                address_info: {
                    street_name: 'Main St',
                },
            },
        };
        expect(toSnakeCase(input)).toEqual(expected);
    });

    it('handles arrays', () => {
        const input = [
            { itemId: 1, itemName: 'Apple' },
            { itemId: 2, itemName: 'Banana' },
        ];
        const expected = [
            { item_id: 1, item_name: 'Apple' },
            { item_id: 2, item_name: 'Banana' },
        ];
        expect(toSnakeCase(input)).toEqual(expected);
    });

    it('leaves already snake_case keys alone', () => {
        const input = {
            created_at: '2023-01-01',
            owner_id: '123',
        };
        const expected = {
            created_at: '2023-01-01',
            owner_id: '123',
        };
        expect(toSnakeCase(input)).toEqual(expected);
    });

    it('handles mixed case keys', () => {
        const input = {
            created_at: '2023-01-01',
            updatedAt: '2023-01-02',
        };
        const expected = {
            created_at: '2023-01-01',
            updated_at: '2023-01-02',
        };
        expect(toSnakeCase(input)).toEqual(expected);
    });
});
