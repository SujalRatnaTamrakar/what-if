/**
 * web/src/screens/Feed.tsx — S7 Community feed (§7.5).
 * Editorial header, "What if…" hero with a live before/after, working
 * filters (Nearby by distance, Transit/Streets/Parks by topic tags, Top by
 * supporters, Supported by you), search, nextCursor paging on scroll.
 * Desktop (§12): cards flow into a 3-column grid.
 */
import React, { useMemo, useRef, useState } from "react";
import { Pressable, Spinner, Text, View, styleSheet, useWide } from "../ui/primitives";
import { Display } from "../ui/Display";
import { Chip } from "../ui/Chip";
import { useFeed } from "../hooks/useFeed";
import { ProposalCard } from "../components/ProposalCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { AppHeader } from "../components/AppHeader";
import { ProposalCardSkeleton } from "../components/Skeleton";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { ArrowRightIcon, FlameIcon, LocateIcon, SearchIcon, XIcon } from "../components/icons";
import { useRouter } from "../lib/nav";
import { distanceKm, formatDistance, useProposalLocations, useUserLocation } from "../lib/places";
import { topicsFor, type Topic } from "../lib/tags";
import { useToast } from "../ui/Toast";
import { fonts, shadows, theme } from "../theme";
import type { ProposalSummary } from "../api/types";
import DEMO_BEFORE from "../assets/demo/before.jpg";
import DEMO_AFTER from "../assets/demo/after.jpg";

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

const MAX = 1180;

function Hero({ count, supporters, wide }: { count: number; supporters: number; wide: boolean }) {
  const router = useRouter();
  return (
    <View className="anim-fade-in-down" style={[styles.hero, wide && styles.heroWide]}>
      <View style={styles.heroText}>
        <Text style={styles.heroKicker}>YOUR NEIGHBORHOOD</Text>
        <Display size={wide ? 38 : 26} italic color="#fff" style={styles.heroTitle}>
          What if it could be better?
        </Display>
        <Text style={[styles.heroBody, wide && { fontSize: 15, lineHeight: "22px" }]}>
          {count > 0
            ? `${count} idea${count === 1 ? "" : "s"} · ${supporters} supporter${supporters === 1 ? "" : "s"} so far`
            : "Be the first to imagine a change."}
        </Text>
        <Pressable onPress={() => router.push("/create")} label="Start a proposal" feedback="opacity" style={styles.heroCta}>
          <Text style={styles.heroCtaText}>Start one</Text>
          <ArrowRightIcon size={16} color={theme.colors.accentDark} />
        </Pressable>
      </View>
      <View style={[styles.heroArt, wide && { width: 200 }]}>
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
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const toast = useToast();
  const wide = useWide();
  const [filter, setFilter] = useState<Filter>("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const feed = useFeed("public");
  const me = useUserLocation(true);
  const scroller = useRef<HTMLDivElement>(null);

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
        list = list.filter((it) => distances[it.id] !== undefined).sort((a, b) => distances[a.id] - distances[b.id]);
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

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    // onEndReachedThreshold 0.5
    if (el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * 0.5) {
      if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
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
        return <Spinner size="large" style={{ marginTop: 40 }} />;
      }
      return (
        <EmptyState
          icon={<LocateIcon size={40} color={theme.colors.accent} />}
          title={me.coords ? "Nothing pinned nearby" : "Turn on location"}
          message={
            me.coords
              ? "We couldn't place any proposals near you yet."
              : "WhatIf uses your location only in this browser to sort ideas by distance."
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
        onAction={() => router.push("/create")}
      />
    );
  };

  const grid = wide ? styles.grid : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <View style={styles.inner}>
          <AppHeader
            onSearch={() => {
              setSearching((v) => !v);
              setQuery("");
            }}
          />
          {searching ? (
            <View className="anim-fade-in-down" style={styles.searchBox}>
              <SearchIcon size={18} color={theme.colors.muted} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                type="search"
                enterKeyHint="search"
                placeholder="Search by title or place"
                aria-label="Search proposals"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearching(false);
                    setQuery("");
                  }
                }}
                style={styles.searchInput}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} label="Clear search" feedback="opacity" style={{ padding: 4 }}>
                  <XIcon size={18} color={theme.colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {feed.isLoading ? (
        <View style={styles.body}>
          <View style={[styles.inner, grid]}>
            <ProposalCardSkeleton />
            <ProposalCardSkeleton />
            {wide ? <ProposalCardSkeleton /> : null}
          </View>
        </View>
      ) : feed.isError ? (
        <View style={styles.body}>
          <View style={styles.inner}>
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
          </View>
        </View>
      ) : (
        <View ref={scroller} className="scroll" onScroll={onScroll} style={{ flex: 1, minHeight: 0 }}>
          <View style={[styles.inner, styles.listContent]}>
            {!searching && filter === "all" ? <Hero count={all.length} supporters={supporters} wide={wide} /> : null}
            <View className="hscroll" role="tablist" aria-label="Filters" style={styles.chips}>
              {FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  label={f.label}
                  active={filter === f.key}
                  onPress={() => void pickFilter(f.key)}
                  accessibilityRole="tab"
                  style={{ flexShrink: 0 }}
                  icon={
                    f.key === "nearby"
                      ? (c) => <LocateIcon size={15} color={c} />
                      : f.key === "top"
                        ? (c) => <FlameIcon size={15} color={c} />
                        : undefined
                  }
                />
              ))}
            </View>
            {filter !== "all" && items.length > 0 ? (
              <Text className="anim-fade-in" style={styles.resultNote}>
                {filter === "nearby"
                  ? "Closest first"
                  : filter === "top"
                    ? "Most supported first"
                    : `${items.length} idea${items.length === 1 ? "" : "s"}`}
              </Text>
            ) : null}
            {items.length === 0 ? (
              renderEmpty()
            ) : (
              <View style={grid}>
                {items.map((item, index) => (
                  <ProposalCard
                    key={item.id}
                    item={item}
                    index={index}
                    style={wide ? { marginBottom: 0 } : null}
                    distanceLabel={distances[item.id] !== undefined ? formatDistance(distances[item.id]) : null}
                    onPress={() => router.push(`/proposal/${item.id}`)}
                  />
                ))}
              </View>
            )}
            {feed.isFetchingNextPage ? <Spinner style={styles.footer} /> : null}
            {feed.hasNextPage && !feed.isFetchingNextPage ? (
              <Pressable onPress={() => void feed.fetchNextPage()} feedback="opacity" style={styles.more}>
                <Text style={styles.moreText}>Load more</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = styleSheet({
  container: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  inner: { width: "100%", maxWidth: MAX, alignSelf: "center" },
  headerWrap: { paddingLeft: 16, paddingRight: 16, paddingTop: 10 },
  body: { flex: 1, minHeight: 0, paddingLeft: 16, paddingRight: 16, paddingTop: 8 },
  listContent: { paddingLeft: 16, paddingRight: 16, paddingBottom: 32 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, alignItems: "start" },
  chips: { flexDirection: "row", gap: 8, paddingTop: 14, paddingBottom: 14, paddingRight: 16 },
  resultNote: { fontSize: 12, color: theme.colors.muted, marginBottom: 10, marginLeft: 2, fontFamily: fonts.ui, fontWeight: 500 },
  footer: { marginTop: 16, marginBottom: 16 },
  more: { alignSelf: "center", padding: "10px 18px", marginTop: 8 },
  moreText: { color: theme.colors.accent, fontWeight: 600, fontSize: 14 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingLeft: 14,
    paddingRight: 14,
    marginBottom: 6,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontFamily: fonts.ui,
    color: theme.colors.text,
    border: "none",
    outline: "none",
    background: "transparent",
    minWidth: 0,
    height: 44,
  },
  hero: {
    flexDirection: "row",
    backgroundColor: theme.colors.accentDark,
    borderRadius: 26,
    padding: 18,
    marginTop: 6,
    overflow: "hidden",
    ...shadows.lift,
  },
  heroWide: { padding: 32, alignItems: "center" },
  heroText: { flex: 1, paddingRight: 12, justifyContent: "center" },
  heroKicker: { color: theme.colors.orange, fontSize: 11, letterSpacing: 1.6, fontWeight: 700 },
  heroTitle: { marginTop: 6 },
  heroBody: { color: "rgba(255,255,255,0.78)", fontSize: 13, marginTop: 8, lineHeight: "19px" },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.orange,
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 16,
    minHeight: 40,
    marginTop: 14,
  },
  heroCtaText: { color: theme.colors.accentDark, fontWeight: 700, fontSize: 14 },
  heroArt: { width: 116 },
});
