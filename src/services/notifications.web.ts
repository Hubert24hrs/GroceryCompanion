// Reminders are scheduled by the phone; the web app has no equivalent.
import { ExpiryAlert } from '../domain/expiryAlerts';

export const notificationsAvailable = false;

export async function requestNotificationPermission(): Promise<boolean> {
    return false;
}

export async function scheduleExpiryAlerts(_alerts: ExpiryAlert[]): Promise<void> {}
