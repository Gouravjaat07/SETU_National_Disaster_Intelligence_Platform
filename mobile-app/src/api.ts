import * as SecureStore from 'expo-secure-store';
import { API_URL, TOKEN_KEY } from './config';

export class ApiError extends Error {
  status?: number;
  detail: unknown;
  constructor(message: string, status?: number, detail?: unknown) {
    super(message); this.status = status; this.detail = detail;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === 'string' ? detail : detail?.message || `Request failed (${response.status})`;
    if (response.status === 401) await SecureStore.deleteItemAsync(TOKEN_KEY);
    throw new ApiError(message, response.status, detail);
  }
  return body as T;
}

export const api = {
  otp: (mobile: string) => request<any>('/auth/otp/request', { method: 'POST', body: JSON.stringify({ mobile }) }),
  verifyOtp: (payload: any) => request<any>('/auth/otp/verify', { method: 'POST', body: JSON.stringify(payload) }),
  login: (email: string, password: string) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<any>('/auth/me'),
  events: () => request<any>('/events'),
  alerts: () => request<any>('/events/alerts/for-me'),
  shelters: (lat?: number, lng?: number) => request<any>(`/shelters/list${lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ''}`),
  shelter: (id: string) => request<any>(`/shelters/${id}`),
  mySos: () => request<any>('/sos/mine'),
  sos: (id: string) => request<any>(`/sos/${id}`),
  createSos: (payload: any) => request<any>('/sos', { method: 'POST', body: JSON.stringify(payload) }),
  syncSos: (items: any[]) => request<any>('/sos/sync', { method: 'POST', body: JSON.stringify({ items }) }),
  timeline: (id: string) => request<any>(`/sos/${id}/timeline`),
  cancelSos: (id: string) => request<any>(`/sos/${id}/cancel`, { method: 'POST' }),
  rescueDashboard: () => request<any>('/rescue/dashboard'),
  queue: (query = '') => request<any>(`/sos/queue${query}`),
  assigned: () => request<any>('/sos/assigned-to-me'),
  recommendations: (id: string) => request<any>(`/rescue/recommendations/${id}`),
  assign: (id: string, teamId: string, overrideRecommendation = false) => request<any>(`/sos/${id}/assign`, { method: 'POST', body: JSON.stringify({ teamId, overrideRecommendation }) }),
  accept: (id: string) => request<any>(`/sos/${id}/accept`, { method: 'POST' }),
  reject: (id: string, reason: string) => request<any>(`/sos/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  status: (id: string, status: string, location?: any) => request<any>(`/sos/${id}/status`, { method: 'POST', body: JSON.stringify({ status, location }) }),
  complete: (id: string, report: any) => request<any>(`/sos/${id}/complete`, { method: 'POST', body: JSON.stringify(report) }),
  teams: () => request<any>('/rescue/teams'),
  updateTeamLocation: (id: string, location: any) => request<any>(`/rescue/teams/${id}/location`, { method: 'POST', body: JSON.stringify({ location }) }),
  updateShelter: (id: string, path: string, payload: any) => request<any>(`/shelters/${id}/${path}`, { method: 'POST', body: JSON.stringify(payload) }),
  shelterPatch: (id: string, payload: any) => request<any>(`/shelters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  requirements: (id: string) => request<any>(`/shelters/${id}/requirements`),
  addRequirement: (id: string, payload: any) => request<any>(`/shelters/${id}/requirements`, { method: 'POST', body: JSON.stringify(payload) }),
  notifications: () => request<any>('/notifications/mine'),
  registerDevice: (token: string, tokenType: string) => request<any>('/notifications/device', { method: 'POST', body: JSON.stringify({ token, tokenType, platform: tokenType === 'EXPO' ? 'EXPO' : tokenType }) }),
  unregisterDevice: (token: string) => request<any>(`/notifications/device?token=${encodeURIComponent(token)}`, { method: 'DELETE' }),
  transfer: (shelterId: string, payload: any) => request<any>(`/shelters/${shelterId}/transfer`, { method: 'POST', body: JSON.stringify(payload) }),
  offlineShelterSync: (shelterId: string, entries: any[]) => request<any>(`/shelters/${shelterId}/sync-offline`, { method: 'POST', body: JSON.stringify({ entries }) }),
};
