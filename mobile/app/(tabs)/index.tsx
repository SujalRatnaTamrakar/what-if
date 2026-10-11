/**
 * mobile/app/(tabs)/index.tsx — S7 Community feed (§7.5).
 * Editorial header, "What if…" hero with a live before/after, working
 * filters (Nearby by distance, Transit/Streets/Parks by topic tags, Top by
 * supporters, Supported by you), search, pull-to-refresh, nextCursor paging.
 */
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Text } from "../../src/components/Text";
import { Display } from "../../src/ui/Display";
import { Chip } from "../../src/ui/Chip";
import { useFeed } from "../../src/hooks/useFeed";
import { ProposalCard } from "../../src/components/ProposalCard";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { AppHeader } from "../../src/components/AppHeader";
import { ProposalCardSkeleton } from "../../src/components/Skeleton";
import { BeforeAfterSlider } from "../../src/components/BeforeAfterSlider";
import { ArrowRightIcon, FlameIcon, LocateIcon, SearchIcon, XIcon } from "../../src/components/icons";
import { useTopInset } from "../../src/lib/useTopInset";
import { distanceKm, formatDistance, useProposalLocations, useUserLocation } from "../../src/lib/places";
import { topicsFor, type Topic } from "../../src/lib/tags";
import { useToast } from "../../src/ui/Toast";
import { fonts, shadows, theme } from "../../src/theme";
import type { ProposalSummary } from "../../src/api/types";

type Filter = "all" | "nearby" | Topic | "top" | "supported";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "nearby", label: "Nearby" },
  { key: "transit", label: "Transit" },
  { key: "streets", label: "Streets" },
  { key: "parks", label: "Parks" },
  { key: "top", label: "Top" },
  { key: "supported", label: "Supported" },
];

const DEMO_BEFORE = require("../../assets/demo/before.jpg");
const DEMO_AFTER = require("../../assets/demo/after.jpg");

function Hero({ count, supporters }: { count: number; supporters: number }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
      <View style={styles.heroText}>
        <Text style={styles.heroKicker}>YOUR NEIGHBORHOOD</Text>
        <Display size={26} italic color="#fff" style={styles.heroTitle}>
          What if it could be better?
        </Display>
        <Text style={styles.heroBody}>
          {count > 0
            ? `${count} idea${count === 1 ? "" : "s"} · ${supporters} supporter${supporters === 1 ? "" : "s"} so far`
            : "Be the first to imagine a change."}
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/create")}
          accessibilityRole="button"
          accessibilityLabel="Start a proposal"
          style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.heroCtaText}>Start one</Text>
          <ArrowRightIcon size={16} color={theme.colors.accentDark} />
        </Pressable>
      </View>
      <View style={styles.heroArt}>
        <BeforeAfterSlider
          beforeUri={DEMO_BEFORE}
          afterUri={DEMO_AFTER}
          aspectRatio={493 / 659}
          beforeLabel="Now"
          afterLabel="If"
          rounded
          autoplay
          showAiLabel={false}
        />
      </View>
    </Animated.View>
  );
}

export default function CommunityFeedScreen() {
  const top = useTopInset();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const feed = useFeed("public");
  const me = useUserLocation(true);

  const all = useMemo(() => feed.data?.pages.flatMap((pg) => pg.items) ?? [], [feed.data]);
  const { locations, loading: geoLoading } = useProposalLocations(all);

  const distances = useMemo(() => {
    const d: Record<string, number> = {};
    if (!me.coords) return d;
    for (const it of all) {
      const at = locations[it.id];
      if (at) d[it.id] = distanceKm(me.coords, at);
    }
    return d;
  }, [all, locations, me.coords]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: ProposalSummary[] = q
      ? all.filter((it) => it.title.toLowerCase().includes(q) || it.placeLabel.toLowerCase().includes(q))
      : all;
    switch (filter) {
      case "transit":
      case "streets":
      case "parks":
        list = list.filter((it) => topicsFor(it).includes(filter));
        break;
      case "top":
        list = [...list].sort((a, b) => b.supportCount - a.supportCount);
        break;
      case "supported":
        list = list.filter((it) => it.viewerHasSupported);
        break;
      case "nearby":
        list = list
          .filter((it) => distances[it.id] !== undefined)
          .sort((a, b) => distances[a.id] - distances[b.id]);
        break;
    }
    return list;
  }, [all, filter, query, distances]);

  const supporters = all.reduce((n, it) => n + it.supportCount, 0);

  const pickFilter = async (f: Filter) => {
    setFilter(f);
    if (f === "nearby" && !me.coords) {
      const c = await me.request();
      if (!c) toast.show("Allow location to see proposals near you.", "error");
    }
  };

  const renderEmpty = () => {
    if (query.trim()) {
      return (
        <EmptyState
          title="No matches"
          message={`Nothing matches "${query.trim()}".`}
          actionLabel="Clear search"
          onAction={() => setQuery("")}
        />
      );
    }
    if (filter === "nearby") {
      if (me.status === "asking" || geoLoading) {
        return <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.accent} />;
      }
      return (
        <EmptyState
          icon={<LocateIcon size={40} color={theme.colors.accent} />}
          title={me.coords ? "Nothing pinned nearby" : "Turn on location"}
          message={
            me.coords
              ? "We couldn't place any proposals near you yet."
              : "WhatIf uses your location only on this device to sort ideas by distance."
          }
          actionLabel={me.coords ? "Show all" : "Use my location"}
          onAction={() => (me.coords ? setFilter("all") : void pickFilter("nearby"))}
        />
      );
    }
    if (filter !== "all") {
      return (
        <EmptyState
          title={filter === "supported" ? "Nothing supported yet" : `No ${filter} ideas yet`}
          message={filter === "supported" ? "Tap Support on an idea you'd love to see." : "Try the full community feed."}
          actionLabel="Show all"
          onAction={() => setFilter("all")}
        />
      );
    }
    return (
      <EmptyState
        title="No proposals yet"
        message="Be the first. Photograph a place and imagine a change."
        actionLabel="Create a proposal"
        onAction={() => router.push("/(tabs)/create")}
      />
    );
  };

  const header = (
    <View>
      {!searching && filter === "all" ? <Hero count={all.length} supporters={supporters} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            active={filter === f.key}
            onPress={() => void pickFilter(f.key)}
            accessibilityRole="tab"
            icon={
              f.key === "nearby"
                ? (c) => <LocateIcon size={15} color={c} />
                : f.key === "top"
                  ? (c) => <FlameIcon size={15} color={c} />
                  : undefined
            }
          />
        ))}
      </ScrollView>
      {filter !== "all" && items.length > 0 ? (
        <Animated.Text entering={FadeIn} style={styles.resultNote}>
          {filter === "nearby"
            ? "Closest first"
            : filter === "top"
              ? "Most supported first"
              : `${items.length} idea${items.length === 1 ? "" : "s"}`}
        </Animated.Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrap, { paddingTop: top + 10 }]}>
        <AppHeader
          onSearch={() => {
            setSearching((v) => !v);
            setQuery("");
          }}
        />
        {searching ? (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.searchBox}>
            <SearchIcon size={18} color={theme.colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Search by title or place"
              placeholderTextColor={theme.colors.faint}
              returnKeyType="search"
              accessibilityLabel="Search proposals"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} accessibilityLabel="Clear search" hitSlop={8}>
                <XIcon size={18} color={theme.colors.muted} />
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      {feed.isLoading ? (
        <View style={styles.body}>
          <ProposalCardSkeleton />
          <ProposalCardSkeleton />
        </View>
      ) : feed.isError ? (
        <View style={styles.body}>
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <ProposalCard
              item={item}
              index={index}
              distanceLabel={distances[item.id] !== undefined ? formatDistance(distances[item.id]) : null}
              onPress={() => router.push(`/proposal/${item.id}`)}
            />
          )}
          ListEmptyComponent={renderEmpty()}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator size="small" color={theme.colors.accent} style={styles.footer} />
            ) : null
          }
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => void feed.refetch()}
              tintColor={theme.colors.accent}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerWrap: { paddingHorizontal: 16 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  chips: { flexDirection: "row", gap: 8, paddingVertical: 14, paddingRight: 16 },
  resultNote: { fontSize: 12, color: theme.colors.muted, marginBottom: 10, marginLeft: 2, fontFamily: fonts.medium },
  footer: { paddingVertical: 16 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    marginBottom: 6,
    minHeight: 46,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, fontFamily: fonts.regular, color: theme.colors.text },
  hero: {
    flexDirection: "row",
    backgroundColor: theme.colors.accentDark,
    borderRadius: 26,
    padding: 18,
    marginTop: 6,
    overflow: "hidden",
    ...shadows.lift,
  },
  heroText: { flex: 1, paddingRight: 12, justifyContent: "center" },
  heroKicker: { color: theme.colors.orange, fontSize: 11, letterSpacing: 1.6, fontWeight: "700" },
  heroTitle: { marginTop: 6 },
  heroBody: { color: "rgba(255,255,255,0.78)", fontSize: 13, marginTop: 8, lineHeight: 19 },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.orange,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 40,
    marginTop: 14,
  },
  heroCtaText: { color: theme.colors.accentDark, fontWeight: "700", fontSize: 14 },
  heroArt: { width: 116 },
});
