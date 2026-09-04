import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';
import { clearDeviceToken, getDeviceToken, setDeviceToken } from './storage';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });
export type NotificationTarget = { screen: 'AlertDetails' | 'SosDetails' | 'AssignmentDetails' | 'ShelterDetails'; id?: string };
export function targetFromNotification(notification: Notifications.Notification): NotificationTarget | null {
  const data = notification.request.content.data as Record<string, unknown>;
  const objectId = String(data.objectId || data.sosId || data.eventId || data.shelterId || '');
  const type = String(data.objectType || data.type || '').toUpperCase();
  if (!objectId) return null;
  if (type.includes('SHELTER') || data.shelterId) return { screen: 'ShelterDetails', id: objectId };
  if (type.includes('SOS') || data.sosId) return { screen: 'SosDetails', id: objectId };
  if (type.includes('ASSIGN')) return { screen: 'AssignmentDetails', id: objectId };
  return { screen: 'AlertDetails', id: objectId };
}
export async function registerForNotifications() {
  if (!Device.isDevice) return { token: null, reason: 'physical device required' };
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { token: null, reason: `permission ${status}` };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  try {
    const push = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if ((await getDeviceToken()) !== push.data) { await api.registerDevice(push.data, 'EXPO'); await setDeviceToken(push.data); }
    return { token: push.data, reason: 'registered' };
  } catch {
    try {
      const native = await Notifications.getDevicePushTokenAsync();
      const token = String(native.data);
      if ((await getDeviceToken()) !== token) { await api.registerDevice(token, Platform.OS.toUpperCase()); await setDeviceToken(token); }
      return { token: String(native.data), reason: 'native token stored' };
    } catch { return { token: null, reason: 'token unavailable or backend registration failed' }; }
  }
}

export function subscribeToTokenRefresh(onRegistered: (token: string) => void) {
  return Notifications.addPushTokenListener(async ({ data }) => {
    const token = String(data);
    if ((await getDeviceToken()) === token) return;
    try { await api.registerDevice(token, 'EXPO'); await setDeviceToken(token); onRegistered(token); } catch { /* retry on next token refresh or app launch */ }
  });
}
export async function deactivateRegisteredDevice() {
  const token = await getDeviceToken();
  if (!token) return;
  try { await api.unregisterDevice(token); } finally { await clearDeviceToken(); }
}
