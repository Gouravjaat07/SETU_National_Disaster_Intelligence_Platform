import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';
import { jsonStore } from './storage';
import { colors } from './theme';

let backgroundTask: Location.LocationSubscription | null = null;
const BACKGROUND_TASK = 'setu-operational-location';
const TEAM_KEY = 'setu.mobile.active.team';
export function setOperationalTeam(teamId: string | null) { return jsonStore.set(TEAM_KEY, teamId); }

TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations || [];
  const latest = locations[locations.length - 1];
  const teamId = await jsonStore.get<string | null>(TEAM_KEY, null);
  if (!latest || !teamId) return;
  const location: SetuLocation = { latitude: latest.coords.latitude, longitude: latest.coords.longitude, accuracy: latest.coords.accuracy, timestamp: new Date(latest.timestamp).toISOString(), source: (latest.coords.accuracy || 0) > 150 ? 'NETWORK' : 'GPS' };
  await jsonStore.set(KEY, location);
  await api.updateTeamLocation(teamId, location);
});

export type SetuLocation = { latitude: number; longitude: number; accuracy: number | null; timestamp: string; source: 'GPS' | 'NETWORK' | 'LAST_KNOWN' | 'MANUAL' | 'LANDMARK'; landmark?: string };
const KEY = 'setu.mobile.last.location';
export async function acquireLocation(): Promise<SetuLocation | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status === 'granted') {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const result: SetuLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: new Date(position.timestamp).toISOString(), source: (position.coords.accuracy || 0) > 150 ? 'NETWORK' : 'GPS' };
      await jsonStore.set(KEY, result); return result;
    } catch { /* fall through to cached location */ }
  }
  return jsonStore.get<SetuLocation | null>(KEY, null).then((location) => location ? { ...location, source: 'LAST_KNOWN' } : null);
}

export async function startOperationalLocation(onLocation: (location: SetuLocation) => void) {
  if (backgroundTask) return;
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') return false;
  backgroundTask = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 30000 }, async (position) => {
    const location: SetuLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: new Date(position.timestamp).toISOString(), source: (position.coords.accuracy || 0) > 150 ? 'NETWORK' : 'GPS' };
    await jsonStore.set(KEY, location); onLocation(location);
  });
  await Location.startLocationUpdatesAsync(BACKGROUND_TASK, { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 30000, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: 'SETU operational location', notificationBody: 'Location sharing is active for this rescue operation.', notificationColor: colors.primary } });
  return true;
}
export function stopOperationalLocation() { backgroundTask?.remove(); backgroundTask = null; Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK).then((started) => { if (started) return Location.stopLocationUpdatesAsync(BACKGROUND_TASK); }).catch(() => undefined); }
