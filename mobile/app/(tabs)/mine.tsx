/**
 * mobile/app/(tabs)/mine.tsx — S8 My proposals (§7.5).
 * Impact stats, Drafts / Published segments, thumbnail rows with status
 * badges. Tapping fetches the full proposal first (the summary doesn't carry
 * step state) and routes via routeForProposal to the right studio step.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text } from "../../src/components/Text";
import { Display } from "../../src/ui/Display";
import { useToast } from "../../src/ui/Toast";
import { api, ApiError, friendlyMessage, displayMessage } from "../../src/api";
import { useAuth } from "../../src/auth/AuthProvider";
import { useFeed } from "../../src/hooks/useFeed";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { ChevronRightIcon, PeopleIcon, StackIcon } from "../../src/components/icons";
import { useTopInset } from "../../src/lib/useTopInset";
import { formatDate } from "../../src/lib/format";
import { hrefForProposal, routeForProposal } from "../../src/lib/routeForProposal";
import { shadows, theme } from "../../src/theme";
import type { ProposalSummary } from "../../src/api/types";

type Segment = "drafts" | "published";

function statusBadge(item: ProposalSummary): { label: string; bg: string; fg: string } {
  if (item.status === "published") return { label: "Published", bg: theme.colors.accentSoft, fg: theme.colors.accent };
  if (item.status === "ready") return { label: "Ready", bg: theme.colors.infoSoft, fg: theme.colors.info };
  return { label: "Draft", bg: theme.colors.orangeSoft, fg: theme.colors.warning };
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function MineScreen() {
  const top = useTopInset();
  const toast = useToast();
  const { isLoggedIn, isLoading: authLoading, login } = useAuth();
  const feed = useFeed("mine", 20, isLoggedIn);
  const [segment, setSegment] = useState<Segment>("drafts");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const all = useMemo(() => feed.data?.pages.flatMap((pg) => pg.items) ?? [], [feed.data]);
  const drafts = all.filter((i) => i.status !== "published");
  const published = all.filter((i) => i.status === "published");
  const supporters = published.reduce((n, i) => n + i.supportCount, 0);
  const items = segment === "drafts" ? drafts : published;

  const openProposal = async (item: ProposalSummary) => {
    setOpeningId(item.id);
    try {
      const full = await api.getProposal(item.id);
      router.push(hrefForProposal(item.id, routeForProposal(full)));
    } catch (e) {
      toast.show(e instanceof ApiError ? displayMessage(e) : "Couldn't open it.", "error");
    } finally {
      setOpeningId(null);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={[styles.center, { paddingTop: top }]}>
        <EmptyState
          icon={<StackIcon size={40} color={theme.colors.accent} />}
          title="Your ideas live here"
          message="Sign in to keep drafts, finish them later, and see who supports you."
          actionLabel="Sign in"
          onAction={() => void login()}
        />
      </View>
    );
  }

  const header = (
    <View>
      <Display size={30}>
        Your{" "}
        <Display size={30} italic color={theme.colors.accent}>
          what-ifs
        </Display>
      </Display>
      <View style={styles.stats}>
        <Stat value={all.length} label="Ideas" />
        <View style={styles.statDiv} />
        <Stat value={published.length} label="Published" />
        <View style={styles.statDiv} />
        <Stat value={supporters} label="Supporters" />
      </View>
      <View style={styles.segment} accessibilityRole="tablist">
        {(["drafts", "published"] as Segment[]).map((s) => {
          const active = segment === s;
          const n = s === "drafts" ? drafts.length : published.length;
          return (
            <Pressable
              key={s}
              onPress={() => setSegment(s)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.segBtn, active && styles.segOn]}
            >
              <Text style={[styles.segText, active && styles.segTextOn]}>
                {s === "drafts" ? "In progress" : "Published"} · {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {feed.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : feed.isError ? (
        <View style={[styles.body, { paddingTop: top + 16 }]}>
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.list, { paddingTop: top + 16 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const badge = statusBadge(item);
            const opening = openingId === item.id;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).springify().damping(18)}>
                <Pressable
                  onPress={() => void openProposal(item)}
                  disabled={opening}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title || "Untitled proposal"}, ${badge.label}`}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Image
                    source={{ uri: item.conceptThumbUrl ?? item.sourceThumbUrl }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.rowBody}>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                    </View>
                    <Text style={styles.title} numberOfLines={2}>
                      {item.title || "Untitled proposal"}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.placeLabel} · {formatDate(item.updatedAt)}
                    </Text>
                    {item.status === "published" ? (
                      <View style={styles.supRow}>
                        <PeopleIcon size={14} color={theme.colors.accent} />
                        <Text style={styles.sup}>{item.supportCount} supporters</Text>
                      </View>
                    ) : (
                      <Text style={styles.cont}>Continue where you left off</Text>
                    )}
                  </View>
                  {opening ? (
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                  ) : (
                    <ChevronRightIcon size={20} color={theme.colors.faint} />
                  )}
                </Pressable>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title={segment === "drafts" ? "Nothing in progress" : "Nothing published yet"}
              message={segment === "drafts" ? "Start a new idea from a photo." : "Finish a draft to share it with neighbors."}
              actionLabel="Create a proposal"
              onAction={() => router.push("/(tabs)/create")}
            />
          }
          refreshControl={
            <RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={theme.colors.accent} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  stats: {
    flexDirection: "row",
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.xl,
    paddingVertical: 16,
    marginTop: 16,
    ...shadows.lift,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 2 },
  statDiv: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  segment: { flexDirection: "row", backgroundColor: theme.colors.paperDeep, borderRadius: 999, padding: 4, marginTop: 18, marginBottom: 14 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: theme.colors.card, ...shadows.card },
  segText: { fontSize: 14, fontWeight: "600", color: theme.colors.muted },
  segTextOn: { color: theme.colors.accentDark },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 10,
    paddingRight: 14,
    marginBottom: 12,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  thumb: { width: 84, height: 100, borderRadius: 14, backgroundColor: theme.colors.paperDeep },
  rowBody: { flex: 1 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  title: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 6, lineHeight: 20 },
  sub: { fontSize: 12, color: theme.colors.muted, marginTop: 3 },
  supRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  sup: { fontSize: 13, fontWeight: "600", color: theme.colors.accent },
  cont: { fontSize: 12, fontWeight: "600", color: theme.colors.warning, marginTop: 6 },
});
