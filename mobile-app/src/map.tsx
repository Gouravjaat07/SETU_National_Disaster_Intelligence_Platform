import React from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { colors } from './theme';

type Point = { latitude?: number; longitude?: number; name?: string; title?: string; status?: string; priority?: string; id?: string };
function valid(point: Point): point is Point & { latitude: number; longitude: number } { return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude!) <= 90 && Math.abs(point.longitude!) <= 180; }
export function OperationalMap({ center, points, height = 260 }: { center?: Point; points: Point[]; height?: number }) {
  const validPoints = points.filter(valid);
  const first = valid(center || {}) ? center as Point & { latitude: number; longitude: number } : validPoints[0];
  if (!first) return <View style={{ height, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mapSurface, borderRadius: 6 }}><Text style={{ color: colors.textMuted }}>Map unavailable until a valid location is available.</Text></View>;
  const region: Region = { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.2, longitudeDelta: 0.2 };
  return <MapView style={{ height, borderRadius: 8 }} initialRegion={region} showsUserLocation={Boolean(center && valid(center))} loadingEnabled accessibilityLabel="Operational map">{validPoints.map((point, index) => <Marker key={point.id || `${point.latitude}-${point.longitude}-${index}`} coordinate={{ latitude: point.latitude, longitude: point.longitude }} title={point.name || point.title || point.priority || 'Operational location'} description={point.status} />)}</MapView>;
}
