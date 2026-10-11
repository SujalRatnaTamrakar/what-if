/**
 * web/src/components/ProposalMap.tsx — map of proposals (Leaflet + the
 * configured tile server). Pins are the proposal's concept thumbnail in a
 * sprout-green frame; the selected pin turns sun-orange.
 */
import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { View, absoluteFill } from "../ui/primitives";
import type { ProposalSummary } from "../api/types";
import type { LatLng } from "../lib/places";
import { config } from "../config";

export interface MapPin {
  item: ProposalSummary;
  at: LatLng;
}

interface Props {
  pins: MapPin[];
  user: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focus?: LatLng | null;
}

// Atlanta, where the demo lives.
const DEFAULT_CENTER: L.LatLngTuple = [33.7756, -84.3963];

const escapeAttr = (s: string) => s.replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]!);

function pinIcon(item: ProposalSummary, selected: boolean) {
  const src = escapeAttr(item.conceptThumbUrl ?? item.sourceThumbUrl);
  return L.divIcon({
    className: `wi-pin${selected ? " selected" : ""}`,
    html: `<div class="wi-pin-inner"><img src="${src}" alt="" /></div><div class="wi-pin-tail"></div>`,
    iconSize: [46, 51],
    iconAnchor: [23, 51],
  });
}

export function ProposalMap({ pins, user, selectedId, onSelect, focus }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const meMarker = useRef<L.Marker | null>(null);
  const fitted = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(DEFAULT_CENTER, 12);
    L.tileLayer(config.mapTileUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    m.on("click", () => onSelectRef.current(null));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Pins.
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const { item, at } of pins) {
      const selected = item.id === selectedId;
      L.marker([at.latitude, at.longitude], {
        icon: pinIcon(item, selected),
        title: item.title,
        alt: item.title,
        keyboard: true,
        zIndexOffset: selected ? 1000 : 0,
      })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(item.id);
        })
        .addTo(g);
    }
  }, [pins, selectedId]);

  // First fit to everything we know about.
  useEffect(() => {
    const m = map.current;
    if (!m || fitted.current) return;
    const pts = [...pins.map((p) => p.at), ...(user ? [user] : [])];
    if (pts.length === 0) return;
    fitted.current = true;
    if (pts.length === 1) m.setView([pts[0].latitude, pts[0].longitude], 14);
    else m.fitBounds(L.latLngBounds(pts.map((p) => [p.latitude, p.longitude] as L.LatLngTuple)), { padding: [60, 60], maxZoom: 15 });
  }, [pins, user]);

  // The viewer's own location.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    meMarker.current?.remove();
    meMarker.current = user
      ? L.marker([user.latitude, user.longitude], {
          icon: L.divIcon({ className: "", html: '<div class="wi-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          interactive: false,
          keyboard: false,
        }).addTo(m)
      : null;
  }, [user]);

  useEffect(() => {
    if (focus) map.current?.flyTo([focus.latitude, focus.longitude], 15, { duration: 0.45 });
  }, [focus]);

  return <View ref={el} aria-label="Map of proposals" style={[absoluteFill, { zIndex: 0 }]} />;
}
