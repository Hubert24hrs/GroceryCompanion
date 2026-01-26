/**
 * Converts a string to snake_case.
 */
export function stringToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Recursively converts object keys to snake_case.
 */
export function toSnakeCase(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(v => toSnakeCase(v));
    } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const snakeKey = stringToSnakeCase(key);
            result[snakeKey] = toSnakeCase(obj[key]);
            return result;
        }, {} as any);
    }
    return obj;
}
