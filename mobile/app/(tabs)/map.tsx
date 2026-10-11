/**
 * mobile/app/(tabs)/map.tsx — Map of community proposals.
 * Pins come from on-device geocoding of each placeLabel (or the author's own
 * capture location). A snapping card carousel mirrors the pins; tapping a
 * pin scrolls to its card, tapping a card flies the map there.
 */
import React, { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Text } from "../../src/components/Text";
import { ProposalMap, type MapPin } from "../../src/components/ProposalMap";
import { LocateIcon, PeopleIcon, PinIcon } from "../../src/components/icons";
import { useFeed } from "../../src/hooks/useFeed";
import { distanceKm, formatDistance, useProposalLocations, useUserLocation, type LatLng } from "../../src/lib/places";
import { useTopInset } from "../../src/lib/useTopInset";
import { useToast } from "../../src/ui/Toast";
import { shadows, theme } from "../../src/theme";

export default function MapScreen() {
  const top = useTopInset();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const feed = useFeed("public");
  const me = useUserLocation(true);
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const { locations, loading } = useProposalLocations(items);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const list = useRef<FlatList>(null);

  const pins: MapPin[] = useMemo(
    () => items.flatMap((item) => (locations[item.id] ? [{ item, at: locations[item.id]! }] : [])),
    [items, locations]
  );
  const unplaced = items.length - pins.length;
  const cardW = Math.min(width - 64, 360);

  const select = (id: string | null) => {
    setSelected(id);
    if (!id) return;
    const idx = pins.findIndex((p) => p.item.id === id);
    if (idx >= 0) list.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  };

  const locate = async () => {
    const c = me.coords ?? (await me.request());
    if (c) setFocus({ ...c });
    else toast.show("Allow location to center the map on you.", "error");
  };

  return (
    <View style={styles.root}>
      <ProposalMap pins={pins} user={me.coords} selectedId={selected} onSelect={select} focus={focus} />

      <View style={[styles.topBar, { top: top + 10 }]} pointerEvents="box-none">
        <View style={styles.titlePill}>
          <Text style={styles.title}>Ideas on the map</Text>
          <Text style={styles.sub}>
            {loading || feed.isLoading
              ? "Placing pins…"
              : `${pins.length} pinned${unplaced > 0 ? ` · ${unplaced} without a location` : ""}`}
          </Text>
        </View>
        <Pressable onPress={locate} accessibilityRole="button" accessibilityLabel="Center on my location" style={styles.locate}>
          {me.status === "asking" ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <LocateIcon size={22} color={theme.colors.accent} />
          )}
        </Pressable>
      </View>

      {pins.length > 0 ? (
        <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.carouselWrap}>
          <FlatList
            ref={list}
            data={pins}
            horizontal
            keyExtractor={(p) => p.item.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: (width - cardW) / 2 - 6 }}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item: { item, at } }) => {
              const active = item.id === selected;
              const dist = me.coords ? formatDistance(distanceKm(me.coords, at)) : null;
              return (
                <Pressable
                  onPress={() => {
                    if (active) router.push(`/proposal/${item.id}`);
                    else {
                      setSelected(item.id);
                      setFocus({ ...at });
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${active ? "Open" : "Show on map"}`}
                  style={[styles.card, { width: cardW }, active && styles.cardActive]}
                >
                  <Image
                    source={{ uri: item.conceptThumbUrl ?? item.sourceThumbUrl }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.row}>
                      <PinIcon size={13} color={theme.colors.muted} />
                      <Text style={styles.meta} numberOfLines={1}>
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
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.accentSoft },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  titlePill: {
    flex: 1,
    backgroundColor: "rgba(251, 248, 241, 0.96)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadows.card,
  },
  title: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
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
  carouselWrap: { position: "absolute", left: 0, right: 0, bottom: 16 },
  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    marginHorizontal: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    ...shadows.lift,
  },
  cardActive: { borderColor: theme.colors.orange },
  thumb: { width: 96, height: 112 },
  cardBody: { flex: 1, padding: 12, justifyContent: "space-between" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontSize: 12, color: theme.colors.muted, flex: 1 },
  supporters: { fontSize: 13, fontWeight: "700", color: theme.colors.accent },
  open: { marginLeft: "auto", fontSize: 12, fontWeight: "600", color: theme.colors.accent },
});
