/**
 * mobile/app/(tabs)/mine.tsx — S8 My proposals (§7.5).
 * Status badges (Draft / Ready / Published / Processing); tap routes via
 * routeForProposal (full proposal is fetched first, since the feed summary
 * doesn't carry step state).
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { api, ApiError, friendlyMessage } from "../../src/api";
import { useAuth } from "../../src/auth/AuthProvider";
import { useFeed } from "../../src/hooks/useFeed";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { AppHeader } from "../../src/components/AppHeader";
import { theme } from "../../src/theme";
import { formatDate } from "../../src/lib/format";
import {
  hrefForProposal,
  routeForProposal,
} from "../../src/lib/routeForProposal";
import type { ProposalSummary } from "../../src/api/types";

function statusBadge(item: ProposalSummary): { label: string; bg: string; fg: string } {
  if (item.status === "published")
    return { label: "Published", bg: theme.colors.successSoft, fg: theme.colors.success };
  // Feed summaries don't carry activeJob; "Processing" is approximated by
  // drafts/ready items — the detail screens show the live job state.
  if (item.status === "ready")
    return { label: "Ready", bg: theme.colors.infoSoft, fg: theme.colors.info };
  return { label: "Draft", bg: theme.colors.border, fg: theme.colors.muted };
}

export default function MineScreen() {
  const { isLoggedIn, isLoading: authLoading, login } = useAuth();
  const feed = useFeed("mine");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const openProposal = async (item: ProposalSummary) => {
    setOpeningId(item.id);
    try {
      const full = await api.getProposal(item.id);
      router.push(hrefForProposal(item.id, routeForProposal(full)));
    } catch (e) {
      showToast(
        e instanceof ApiError ? friendlyMessage(e.code) : "Couldn't open it."
      );
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
      <View style={styles.container}>
        <EmptyState
          title="Sign in to see your proposals"
          message="Your drafts and published proposals live here."
          actionLabel="Sign in"
          onAction={() => void login()}
        />
      </View>
    );
  }

  const items = feed.data?.pages.flatMap((pg) => pg.items) ?? [];

  if (feed.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (feed.isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>My proposals</Text>
        <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerWrap}>
        <AppHeader />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const badge = statusBadge(item);
          const opening = openingId === item.id;
          return (
            <Pressable
              onPress={() => void openProposal(item)}
              disabled={opening}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${badge.label}`}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowBody}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title || "Untitled proposal"}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.placeLabel} · {formatDate(item.updatedAt)}
                </Text>
              </View>
              {opening ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.fg }]}>
                    {badge.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.heading}>My proposals</Text>}
        ListEmptyComponent={
          <EmptyState
            title="Nothing here yet"
            message="Start your first proposal."
            actionLabel="Create a proposal"
            onAction={() => router.push("/(tabs)/create")}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => {
              void feed.refetch();
            }}
            tintColor={theme.colors.accent}
          />
        }
      />
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.l },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  list: { padding: theme.spacing.l, paddingTop: 4, paddingBottom: theme.spacing.xxl },
  headerWrap: { paddingHorizontal: 16, paddingTop: 14 },
  heading: {
    fontSize: theme.fontSize.xxl,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: theme.spacing.m,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.m,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.s,
  },
  pressed: { opacity: 0.7 },
  rowBody: { flex: 1, marginRight: theme.spacing.s },
  title: { fontSize: theme.fontSize.m, fontWeight: "700", color: theme.colors.text },
  sub: { fontSize: theme.fontSize.s, color: theme.colors.muted, marginTop: 2 },
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  toast: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: "#1F2933",
    borderRadius: theme.radius.m,
    padding: 14,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
