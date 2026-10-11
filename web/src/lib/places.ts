/**
 * web/src/lib/places.ts — browser location features (Map, Nearby, "Use my
 * location"). The contract carries only a free-text placeLabel, so
 * coordinates come from (1) where the author was when they created the
 * proposal (stored in this browser) or (2) a Nominatim-compatible geocoder
 * on placeLabel (config.geocoderUrl; empty disables it). No backend changes,
 * no API keys. Everything degrades to "location unavailable".
 */
import { useCallback, useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { config } from "../config";
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

/** Remember where a proposal's photo was taken (author's browser only). */
export async function rememberProposalLocation(id: string, at: LatLng): Promise<void> {
  await kvSet(`geo_${id}`, `${at.latitude},${at.longitude}`);
}

async function recalled(id: string): Promise<LatLng | null> {
  const v = await kvGet(`geo_${id}`);
  if (!v) return null;
  const [lat, lng] = v.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}

// Nominatim's usage policy allows ~1 request/second: serialize lookups.
let geoQueue: Promise<unknown> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = geoQueue.then(fn, fn);
  geoQueue = run.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100))
  );
  return run;
}

async function geocode(label: string): Promise<LatLng | null> {
  if (!config.geocoderUrl || label.trim().length < 3) return null;
  const cached = await kvGet(`geocode_${label}`);
  if (cached === "none") return null;
  if (cached) {
    const [lat, lng] = cached.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }
  // Free-text labels ("MARTA stop, Ponce de Leon Ave & N Highland") often
  // miss as-is: retry as an intersection, then without the leading landmark.
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  const attempts = [label, label.replace(/\s*&\s*/g, " and "), parts.slice(1).join(", ").replace(/\s*&\s*/g, " and ")];
  for (const q of [...new Set(attempts)].filter((q) => q.length >= 3)) {
    try {
      const url = `${config.geocoderUrl.replace(/\/$/, "")}/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      const rows = await throttled(async () => (await fetch(url, { headers: { Accept: "application/json" } })).json());
      const hit = Array.isArray(rows) ? rows[0] : null;
      if (!hit) continue;
      const at = { latitude: Number(hit.lat), longitude: Number(hit.lon) };
      await kvSet(`geocode_${label}`, `${at.latitude},${at.longitude}`);
      return at;
    } catch {
      return null;
    }
  }
  await kvSet(`geocode_${label}`, "none");
  return null;
}

/** Short "name, street, city" label for coordinates (reverse geocode). */
export async function reverseGeocode(at: LatLng): Promise<string | null> {
  if (!config.geocoderUrl) return null;
  try {
    const url = `${config.geocoderUrl.replace(/\/$/, "")}/reverse?format=jsonv2&zoom=18&lat=${at.latitude}&lon=${at.longitude}`;
    const r = await throttled(async () => (await fetch(url, { headers: { Accept: "application/json" } })).json());
    const a = r?.address ?? {};
    const street = a.road ?? a.pedestrian ?? a.footway ?? null;
    const name = r?.name && r.name !== street ? r.name : null;
    const city = a.city ?? a.town ?? a.village ?? a.suburb ?? null;
    const label = [name, street, city].filter(Boolean).join(", ").slice(0, 120);
    return label.length >= 3 ? label : null;
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

/** One position fix from the browser. Rejects on denial/timeout. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 15_000 }
    );
  });
}

/** The viewer's location, requested only when a feature needs it. */
export function useUserLocation(autoRequest = false) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<LatLng | null>(null);

  const request = useCallback(async (): Promise<LatLng | null> => {
    setStatus("asking");
    try {
      const c = await currentPosition();
      setCoords(c);
      setStatus("granted");
      return c;
    } catch (e) {
      const denied = typeof GeolocationPositionError !== "undefined" && e instanceof GeolocationPositionError && e.code === e.PERMISSION_DENIED;
      setStatus(denied ? "denied" : "unavailable");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!autoRequest) return;
    // Only auto-ask when permission was already granted (never surprise-prompt).
    let alive = true;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (alive && p.state === "granted") void request();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [autoRequest, request]);

  return { status, coords, request };
}
