import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY } from './config';

export const jsonStore = {
  async get<T>(key: string, fallback: T): Promise<T> { try { const value = await AsyncStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } },
  set(key: string, value: unknown) { return AsyncStorage.setItem(key, JSON.stringify(value)); },
};
export const authStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
export const SOS_QUEUE = 'setu.mobile.sos.queue';
export const SHELTER_QUEUE = 'setu.mobile.shelter.queue';
export const DEVICE_TOKEN = 'setu.mobile.device.token';
export async function getDeviceToken() { return jsonStore.get<string | null>(DEVICE_TOKEN, null); }
export async function setDeviceToken(token: string) { return jsonStore.set(DEVICE_TOKEN, token); }
export async function clearDeviceToken() { return AsyncStorage.removeItem(DEVICE_TOKEN); }
