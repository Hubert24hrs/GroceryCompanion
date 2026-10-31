import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fromISODate } from '../domain/dates';
import { ALERT_HOUR, ExpiryAlert } from '../domain/expiryAlerts';

export const notificationsAvailable = true;

const CHANNEL = 'expiry-alerts';

Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Ask once; later calls just report the answer the user gave. */
export async function requestNotificationPermission(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replace every scheduled reminder with these. */
export async function scheduleExpiryAlerts(alerts: ExpiryAlert[]): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!alerts.length) return;
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Expiry alerts', importance: Notifications.AndroidImportance.DEFAULT });
    }
    for (const { date, title, body } of alerts) {
        const at = fromISODate(date);
        at.setHours(ALERT_HOUR);
        await Notifications.scheduleNotificationAsync({
            content: { title, body },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
    }
}
