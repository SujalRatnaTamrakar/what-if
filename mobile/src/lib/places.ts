/**
 * mobile/src/lib/places.ts — on-device location features (Map, Nearby).
 * The contract carries only a free-text placeLabel, so coordinates come
 * from (1) where the author was when they created the proposal (stored on
 * that device) or (2) the OS geocoder on placeLabel. No backend changes,
 * no API keys. Everything degrades to "location unavailable".
 */
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { useQueries } from "@tanstack/react-query";
import { kvGet, kvSet } from "./kv";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  const mi = km * 0.621371;
  if (mi < 0.1) return "Right here";
  if (mi < 10) return `${mi.toFixed(1)} mi away`;
  return `${Math.round(mi)} mi away`;
}

/** Remember where a proposal's photo was taken (author's device only). */
export async function rememberProposalLocation(id: string, at: LatLng): Promise<void> {
  await kvSet(`geo_${id}`, `${at.latitude},${at.longitude}`);
}

async function recalled(id: string): Promise<LatLng | null> {
  const v = await kvGet(`geo_${id}`);
  if (!v) return null;
  const [lat, lng] = v.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}

async function geocode(label: string): Promise<LatLng | null> {
  if (Platform.OS === "web" || label.trim().length < 3) return null;
  try {
    const r = await Location.geocodeAsync(label);
    return r[0] ? { latitude: r[0].latitude, longitude: r[0].longitude } : null;
  } catch {
    return null;
  }
}

/** Best-known coordinates for each proposal; cached for the session. */
export function useProposalLocations(items: { id: string; placeLabel: string }[]) {
  const results = useQueries({
    queries: items.map((it) => ({
      queryKey: ["geo", it.id, it.placeLabel],
      queryFn: async () => (await recalled(it.id)) ?? (await geocode(it.placeLabel)),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
    })),
  });
  const map: Record<string, LatLng | null> = {};
  items.forEach((it, i) => {
    map[it.id] = results[i]?.data ?? null;
  });
  const loading = results.some((r) => r.isLoading);
  return { locations: map, loading };
}

export type LocationStatus = "idle" | "asking" | "granted" | "denied" | "unavailable";

/** The viewer's location, requested only when a feature needs it. */
export function useUserLocation(autoRequest = false) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<LatLng | null>(null);

  const request = useCallback(async (): Promise<LatLng | null> => {
    setStatus("asking");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus("denied");
        return null;
      }
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(c);
      setStatus("granted");
      return c;
    } catch {
      setStatus("unavailable");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!autoRequest) return;
    // Only auto-ask when permission was already granted (never surprise-prompt).
    (async () => {
      try {
        const p = await Location.getForegroundPermissionsAsync();
        if (p.granted) void request();
      } catch {
        setStatus("unavailable");
      }
    })();
  }, [autoRequest, request]);

  return { status, coords, request };
}
