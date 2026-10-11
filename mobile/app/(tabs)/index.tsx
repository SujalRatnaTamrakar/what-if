/**
 * mobile/app/(tabs)/index.tsx — S7 Community feed (§7.5) in the mockup
 * visual language. App header, filter chips (All active; others show an
 * honest empty state — the MVP contract only carries the `shade` category),
 * feed cards, pull-to-refresh, nextCursor pagination.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, TextInput, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../src/components/Text";
import { router } from "expo-router";
import { useFeed } from "../../src/hooks/useFeed";
import { ProposalCard } from "../../src/components/ProposalCard";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { AppHeader } from "../../src/components/AppHeader";
import { ProposalCardSkeleton } from "../../src/components/Skeleton";
import { SearchIcon } from "../../src/components/icons";
import { useTopInset } from "../../src/lib/useTopInset";
import { fonts, theme } from "../../src/theme";

const CHIPS = ["All", "Transit", "Streets", "Parks", "Nearby"] as const;

export default function CommunityFeedScreen() {
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("All");
  const feed = useFeed("public");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const top = useTopInset();
  const all = useMemo(
    () => feed.data?.pages.flatMap((pg) => pg.items) ?? [],
    [feed.data]
  );
  const q = query.trim().toLowerCase();
  const items = q
    ? all.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.placeLabel.toLowerCase().includes(q)
      )
    : all;
  const filtered = chip === "All";

  const renderBody = () => {
    if (feed.isLoading) {
      return (
        <View>
          <ProposalCardSkeleton />
          <ProposalCardSkeleton />
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          q ? (
            <EmptyState
              title="No matches"
              message={`Nothing matches "${query.trim()}".`}
              actionLabel="Clear search"
              onAction={() => setQuery("")}
            />
          ) : (
            <EmptyState
              title="No proposals yet"
              message="Be the first. Create one."
              actionLabel="Create a proposal"
              onAction={() => router.push("/(tabs)/create")}
            />
          )
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
      <View style={[styles.headerWrap, { paddingTop: top + 14 }]}>
        <AppHeader
          onSearch={() => {
            setSearching((v) => !v);
            setQuery("");
          }}
        />
        {searching ? (
          <View style={styles.searchBox}>
            <SearchIcon size={18} color={theme.colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Search by title or place"
              placeholderTextColor={theme.colors.muted}
              returnKeyType="search"
              accessibilityLabel="Search proposals"
              style={styles.searchInput}
            />
          </View>
        ) : null}
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
  headerWrap: { paddingHorizontal: 16 },
  listContent: { paddingTop: 4, paddingBottom: 24 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    marginBottom: 10,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: theme.colors.text,
  },
  chips: { flexDirection: "row", marginTop: 2, marginBottom: 4, paddingRight: 16 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: "#ECE6D8",
  },
  chipActive: { backgroundColor: theme.colors.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: theme.colors.muted },
  chipTextActive: { color: "#fff" },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  footer: { paddingVertical: 16 },
});
