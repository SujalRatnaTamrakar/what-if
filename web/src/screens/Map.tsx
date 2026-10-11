/**
 * web/src/screens/Map.tsx — Map of community proposals.
 * Pins come from geocoding each placeLabel (or the author's own capture
 * location in this browser). A snapping card carousel mirrors the pins;
 * clicking a pin scrolls to its card, clicking a card flies the map there.
 */
import React, { useMemo, useRef, useState } from "react";
import { Img, Pressable, Spinner, Text, View, styleSheet, useWindowWidth } from "../ui/primitives";
import { ProposalMap, type MapPin } from "../components/ProposalMap";
import { LocateIcon, PeopleIcon, PinIcon } from "../components/icons";
import { useFeed } from "../hooks/useFeed";
import { useRouter } from "../lib/nav";
import { distanceKm, formatDistance, useProposalLocations, useUserLocation, type LatLng } from "../lib/places";
import { useToast } from "../ui/Toast";
import { shadows, theme } from "../theme";

export default function MapScreen() {
  const router = useRouter();
  const width = useWindowWidth();
  const toast = useToast();
  const feed = useFeed("public");
  const me = useUserLocation(true);
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const { locations, loading } = useProposalLocations(items);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const cards = useRef<Record<string, HTMLButtonElement | null>>({});

  const pins: MapPin[] = useMemo(
    () => items.flatMap((item) => (locations[item.id] ? [{ item, at: locations[item.id]! }] : [])),
    [items, locations]
  );
  const unplaced = items.length - pins.length;
  const cardW = Math.min(width - 64, 360);

  const select = (id: string | null) => {
    setSelected(id);
    if (!id) return;
    cards.current[id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const locate = async () => {
    const c = me.coords ?? (await me.request());
    if (c) setFocus({ ...c });
    else toast.show("Allow location to center the map on you.", "error");
  };

  return (
    <View style={styles.root}>
      <ProposalMap pins={pins} user={me.coords} selectedId={selected} onSelect={select} focus={focus} />

      <View style={styles.topBar}>
        <View style={styles.titlePill}>
          <Text as="h1" style={styles.title}>
            Ideas on the map
          </Text>
          <Text style={styles.sub}>
            {loading || feed.isLoading
              ? "Placing pins…"
              : `${pins.length} pinned${unplaced > 0 ? ` · ${unplaced} without a location` : ""}`}
          </Text>
        </View>
        <Pressable onPress={locate} label="Center on my location" feedback="scale" style={styles.locate}>
          {me.status === "asking" ? <Spinner /> : <LocateIcon size={22} color={theme.colors.accent} />}
        </Pressable>
      </View>

      {pins.length > 0 ? (
        <View className="anim-fade-in-up" style={styles.carouselWrap}>
          <View
            className="hscroll"
            style={{
              flexDirection: "row",
              scrollSnapType: "x mandatory",
              paddingLeft: Math.max(0, (width - cardW) / 2 - 6),
              paddingRight: Math.max(0, (width - cardW) / 2 - 6),
              paddingTop: 8,
              paddingBottom: 8,
            }}
          >
            {pins.map(({ item, at }) => {
              const active = item.id === selected;
              const dist = me.coords ? formatDistance(distanceKm(me.coords, at)) : null;
              return (
                <Pressable
                  key={item.id}
                  ref={(el) => {
                    cards.current[item.id] = el;
                  }}
                  onPress={() => {
                    if (active) router.push(`/proposal/${item.id}`);
                    else {
                      setSelected(item.id);
                      setFocus({ ...at });
                    }
                  }}
                  label={`${item.title}. ${active ? "Open" : "Show on map"}`}
                  feedback="soft"
                  style={[styles.card, { width: cardW }, active && styles.cardActive]}
                >
                  <Img src={item.conceptThumbUrl ?? item.sourceThumbUrl} style={styles.thumb} />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} lines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.row}>
                      <PinIcon size={13} color={theme.colors.muted} />
                      <Text style={styles.meta} lines={1}>
                        {dist ?? item.placeLabel}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <PeopleIcon size={13} color={theme.colors.accent} />
                      <Text style={styles.supporters}>{item.supportCount}</Text>
                      <Text style={styles.open}>{active ? "Open ›" : "Tap to view"}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = styleSheet({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.colors.accentSoft, overflow: "hidden" },
  topBar: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 500,
    maxWidth: 560,
  },
  titlePill: {
    flex: 1,
    backgroundColor: "rgba(251, 248, 241, 0.96)",
    borderRadius: 20,
    padding: "10px 16px",
    ...shadows.card,
  },
  title: { fontSize: 16, fontWeight: 700, color: theme.colors.text },
  sub: { fontSize: 12, color: theme.colors.muted, marginTop: 1 },
  locate: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FBF8F1",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  carouselWrap: { position: "absolute", left: 0, right: 0, bottom: 8, zIndex: 500 },
  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    marginLeft: 6,
    marginRight: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    scrollSnapAlign: "center",
    textAlign: "left",
    ...shadows.lift,
  },
  cardActive: { borderColor: theme.colors.orange },
  thumb: { width: 96, height: 112, flexShrink: 0 },
  cardBody: { flex: 1, padding: 12, justifyContent: "space-between" },
  cardTitle: { fontSize: 15, fontWeight: 700, color: theme.colors.text, lineHeight: "20px" },
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontSize: 12, color: theme.colors.muted, flex: 1 },
  supporters: { fontSize: 13, fontWeight: 700, color: theme.colors.accent },
  open: { marginLeft: "auto", fontSize: 12, fontWeight: 600, color: theme.colors.accent },
});
