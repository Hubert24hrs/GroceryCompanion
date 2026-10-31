import { Recipe } from '../../domain/types';

export const totalMinutes = (r: Pick<Recipe, 'prepMinutes' | 'cookMinutes'>) => (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);

export function formatMinutes(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}
