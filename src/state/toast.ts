import { create } from 'zustand';

export interface Toast {
    id: number;
    message: string;
    tone: 'info' | 'success' | 'warning' | 'error';
    actionLabel?: string;
    onAction?: () => void;
}

interface ToastState {
    current: Toast | null;
    show: (toast: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone']; durationMs?: number }) => void;
    dismiss: () => void;
}

let counter = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastState>(set => ({
    current: null,
    show: ({ durationMs, tone = 'info', ...rest }) => {
        const id = ++counter;
        set({ current: { id, tone, ...rest } });
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => set(s => (s.current?.id === id ? { current: null } : s)), durationMs ?? (rest.actionLabel ? 5000 : 2800));
    },
    dismiss: () => set({ current: null }),
}));

export const toast = (message: string, opts: Partial<Omit<Toast, 'id' | 'message'>> & { durationMs?: number } = {}) =>
    useToast.getState().show({ message, ...opts });

export const toastError = (e: unknown, fallback = 'Something went wrong.') =>
    toast(e instanceof Error && e.message ? e.message : fallback, { tone: 'error' });
