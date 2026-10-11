/**
 * mobile/app/(tabs)/index.tsx — S7 Community feed (§7.5) in the mockup
 * visual language. App header, filter chips (All active; others show an
 * honest empty state — the MVP contract only carries the `shade` category),
 * feed cards, pull-to-refresh, nextCursor pagination.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useFeed } from "../../src/hooks/useFeed";
import { ProposalCard } from "../../src/components/ProposalCard";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { AppHeader } from "../../src/components/AppHeader";
import { theme } from "../../src/theme";

const CHIPS = ["All", "Transit", "Streets", "Parks", "Nearby"] as const;

export default function CommunityFeedScreen() {
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("All");
  const feed = useFeed("public");
  const items = feed.data?.pages.flatMap((pg) => pg.items) ?? [];
  const filtered = chip === "All";

  const renderBody = () => {
    if (feed.isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      );
    }
    if (feed.isError) {
      return <ErrorState error={feed.error} onRetry={() => feed.refetch()} />;
    }
    if (!filtered) {
      return (
        <EmptyState
          title={`No ${chip.toLowerCase()} proposals yet`}
          message="Try the full community feed."
          actionLabel="Show all"
          onAction={() => setChip("All")}
        />
      );
    }
    return (
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProposalCard
            item={item}
            onPress={() => router.push(`/proposal/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No proposals yet"
            message="Be the first. Create one."
            actionLabel="Create a proposal"
            onAction={() => router.push("/(tabs)/create")}
          />
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.accent}
              style={styles.footer}
            />
          ) : undefined
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) {
            void feed.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => {
              void feed.refetch();
            }}
            tintColor={theme.colors.accent}
          />
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <AppHeader />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CHIPS.map((c) => {
            const active = chip === c;
            return (
              <Pressable
                key={c}
                onPress={() => setChip(c)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.body}>{renderBody()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerWrap: { paddingHorizontal: 16, paddingTop: 14 },
  chips: { flexDirection: "row", marginTop: 2, marginBottom: 4 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: "transparent",
  },
  chipActive: { backgroundColor: theme.colors.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: theme.colors.muted },
  chipTextActive: { color: "#fff" },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  footer: { paddingVertical: 16 },
});
