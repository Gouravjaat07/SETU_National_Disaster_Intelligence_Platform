import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
import { jsonStore, SOS_QUEUE, SHELTER_QUEUE } from './storage';

export type NetworkMode = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export function subscribeNetwork(listener: (mode: NetworkMode) => void) {
	return NetInfo.addEventListener((state) => {
		const details = state.details as { isConnectionExpensive?: boolean } | null;
		listener(state.isConnected === false ? 'OFFLINE' : details?.isConnectionExpensive ? 'DEGRADED' : 'ONLINE');
	});
}
export async function queueSos(payload: any) { const current = await jsonStore.get<any[]>(SOS_QUEUE, []); if (payload.clientRef && current.some((item) => item.clientRef === payload.clientRef)) return; await jsonStore.set(SOS_QUEUE, [...current, { ...payload, clientRef: payload.clientRef || `mobile-${Date.now()}`, clientCreatedAt: payload.clientCreatedAt || new Date().toISOString(), networkStatus: 'OFFLINE' }]); }
export async function syncSosQueue() { const queue = await jsonStore.get<any[]>(SOS_QUEUE, []); if (!queue.length) return { synced: 0, results: [] }; const result = await api.syncSos(queue); await jsonStore.set(SOS_QUEUE, queue.filter((item) => !result.results?.some((r: any) => r.clientRef === item.clientRef && r.ok))); return result; }
export async function queueShelterEvent(event: any) { const current = await jsonStore.get<any[]>(SHELTER_QUEUE, []); await jsonStore.set(SHELTER_QUEUE, [...current, { ...event, occurredAt: event.occurredAt || new Date().toISOString() }]); }
export async function syncShelterQueue(shelterId: string) {
	const queue = await jsonStore.get<any[]>(SHELTER_QUEUE, []);
	const entries = queue.filter((item) => item.shelterId === shelterId);
	if (!entries.length) return { applied: 0, rejected: [], status: 'SYNCED' };
	const result = await api.offlineShelterSync(shelterId, entries);
	const rejectedCounts = new Map<number, number>();
	(result.rejected || []).forEach((item: any) => rejectedCounts.set(item.count, (rejectedCounts.get(item.count) || 0) + 1));
	let rejectedSeen = new Map<number, number>();
	const retained = entries.filter((item) => {
		const count = Number(item.count);
		const seen = rejectedSeen.get(count) || 0;
		if (seen < (rejectedCounts.get(count) || 0)) { rejectedSeen.set(count, seen + 1); return true; }
		return false;
	});
	await jsonStore.set(SHELTER_QUEUE, queue.filter((item) => item.shelterId !== shelterId).concat(retained));
	return result;
}
