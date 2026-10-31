import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { today } from '../domain/dates';
import { hasFeature } from '../domain/entitlements';
import { planExpiryAlerts } from '../domain/expiryAlerts';
import { requestNotificationPermission, scheduleExpiryAlerts } from '../services/notifications';
import { useTable } from './hooks';
import { usePrefs } from './prefs';
import { useIsPro, useSession } from './session';
import { toast, toastError } from './toast';

/** Turn reminders on, asking for permission first. */
export async function enableExpiryAlerts(): Promise<void> {
    const granted = await requestNotificationPermission();
    if (!granted) {
        toast('Notifications are off for Grocery Companion, so reminders can’t be shown.', {
            tone: 'warning',
            actionLabel: 'Open settings',
            onAction: () => void Linking.openSettings().catch(toastError),
        });
        return;
    }
    await usePrefs.getState().update({ expiryAlerts: true });
    toast('Expiry alerts are on.', { tone: 'success' });
}

/** Keeps the phone's scheduled reminders in step with the pantry. */
export function useExpiryAlerts() {
    const pantry = useTable('pantry_items');
    const enabled = usePrefs(s => s.prefs.expiryAlerts);
    const daysBefore = usePrefs(s => s.prefs.expiryAlertDays);
    const allowed = hasFeature(useIsPro(), 'pantryAlerts');
    // Until the store answers, a subscriber looks free: don't drop their reminders.
    const proKnown = useSession(s => s.storePro !== null || s.user === null);
    const lastPlan = useRef<string | null>(null);

    useEffect(() => {
        if (!allowed && !proKnown) return;
        const timer = setTimeout(() => {
            const alerts = enabled && allowed ? planExpiryAlerts(pantry, today(), daysBefore, new Date().getHours()) : [];
            const plan = JSON.stringify(alerts);
            if (plan === lastPlan.current) return;
            lastPlan.current = plan;
            scheduleExpiryAlerts(alerts).catch(e => console.warn('Could not schedule expiry alerts:', (e as Error).message));
        }, 1000);
        return () => clearTimeout(timer);
    }, [pantry, enabled, daysBefore, allowed, proKnown]);
}
