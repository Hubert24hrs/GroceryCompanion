import { Role } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

/** Trim, collapse whitespace and strip control characters. */
export function cleanText(value: string, max = 500): string {
     
    return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}

export function validateName(value: string, label = 'Name', max = 120): Result<string> {
    const text = cleanText(value, max + 1);
    if (!text) return fail(`${label} can't be empty.`);
    if (text.length > max) return fail(`${label} must be ${max} characters or fewer.`);
    return ok(text);
}

/** Parse an optional non-negative number typed by the user ("", "2", "1.5", "1,5"). */
export function parseOptionalNumber(value: string, label: string, max = 100_000): Result<number | null> {
    const text = value.trim().replace(',', '.');
    if (!text) return ok(null);
    const n = Number(text);
    if (!Number.isFinite(n)) return fail(`${label} must be a number.`);
    if (n < 0) return fail(`${label} can't be negative.`);
    if (n > max) return fail(`${label} is too large.`);
    return ok(Math.round(n * 1000) / 1000);
}

export function parseMoney(value: string, label = 'Price'): Result<number | null> {
    const res = parseOptionalNumber(value.replace(/[^\d.,-]/g, ''), label, 1_000_000);
    if (!res.ok || res.value == null) return res;
    return ok(Math.round(res.value * 100) / 100);
}

export function validateEmail(value: string): Result<string> {
    const email = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Enter a valid email address.');
    return ok(email);
}

export function validatePassword(value: string): Result<string> {
    if (value.length < 8) return fail('Password must be at least 8 characters.');
    if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) return fail('Use at least one letter and one number.');
    return ok(value);
}

export function normalizeInviteCode(value: string): Result<string> {
    const code = value.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(code)) return fail('Invite codes are 10 letters and numbers.');
    return ok(code);
}

export function validateUrl(value: string): Result<string | null> {
    const text = value.trim();
    if (!text) return ok(null);
    if (!/^https:\/\/[^\s]+$/i.test(text)) return fail('Use a full https:// link.');
    return ok(text);
}

// Household permissions (mirrors the RLS policies in supabase/migrations).
export const canEdit = (role: Role | null | undefined) => role === 'owner' || role === 'editor';
export const canManageMembers = (role: Role | null | undefined) => role === 'owner';
export const canInvite = (role: Role | null | undefined) => role === 'owner' || role === 'editor';
