/**
 * web/src/screens/Mine.tsx — S8 My proposals (§7.5).
 * Impact stats, Drafts / Published segments, thumbnail rows with status
 * badges. Opening fetches the full proposal first (the summary doesn't carry
 * step state) and routes via routeForProposal to the right studio step.
 */
import React, { useMemo, useState } from "react";
import { COLUMN, CenterSpinner, Img, Pressable, Spinner, Text, View, styleSheet } from "../ui/primitives";
import { Display } from "../ui/Display";
import { useToast } from "../ui/Toast";
import { api, ApiError, displayMessage } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { useFeed } from "../hooks/useFeed";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ChevronRightIcon, PeopleIcon, StackIcon } from "../components/icons";
import { formatDate } from "../lib/format";
import { useRouter } from "../lib/nav";
import { hrefForProposal, routeForProposal } from "../lib/routeForProposal";
import { shadows, theme } from "../theme";
import type { ProposalSummary } from "../api/types";

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
  const router = useRouter();
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

  if (authLoading) return <CenterSpinner />;

  if (!isLoggedIn) {
    return (
      <View style={styles.center}>
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

  if (feed.isLoading) return <CenterSpinner />;

  return (
    <View className="scroll" style={styles.screen}>
      <View style={styles.list}>
        {feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : (
          <>
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
            <View style={styles.segment} role="tablist">
              {(["drafts", "published"] as Segment[]).map((s) => {
                const active = segment === s;
                const n = s === "drafts" ? drafts.length : published.length;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSegment(s)}
                    role="tab"
                    selected={active}
                    feedback="none"
                    style={[styles.segBtn, active && styles.segOn]}
                  >
                    <Text style={[styles.segText, active && styles.segTextOn]}>
                      {s === "drafts" ? "In progress" : "Published"} · {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {items.length === 0 ? (
              <EmptyState
                title={segment === "drafts" ? "Nothing in progress" : "Nothing published yet"}
                message={segment === "drafts" ? "Start a new idea from a photo." : "Finish a draft to share it with neighbors."}
                actionLabel="Create a proposal"
                onAction={() => router.push("/create")}
              />
            ) : (
              items.map((item, index) => {
                const badge = statusBadge(item);
                const opening = openingId === item.id;
                return (
                  <View key={item.id} className="anim-fade-in-down" style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}>
                    <Pressable
                      onPress={() => void openProposal(item)}
                      disabled={opening}
                      label={`${item.title || "Untitled proposal"}, ${badge.label}`}
                      feedback="soft"
                      style={styles.row}
                    >
                      <Img src={item.conceptThumbUrl ?? item.sourceThumbUrl} transition={200} style={styles.thumb} />
                      <View style={styles.rowBody}>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                        </View>
                        <Text style={styles.title} lines={2}>
                          {item.title || "Untitled proposal"}
                        </Text>
                        <Text style={styles.sub} lines={1}>
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
                      {opening ? <Spinner /> : <ChevronRightIcon size={20} color={theme.colors.faint} />}
                    </Pressable>
                  </View>
                );
              })
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = styleSheet({
  screen: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  center: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  list: { paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 40, width: "100%", maxWidth: COLUMN, alignSelf: "center" },
  stats: {
    flexDirection: "row",
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.xl,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 16,
    ...shadows.lift,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: 700, color: "#fff" },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 2 },
  statDiv: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  segment: {
    flexDirection: "row",
    backgroundColor: theme.colors.paperDeep,
    borderRadius: 999,
    padding: 4,
    marginTop: 18,
    marginBottom: 14,
  },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: theme.colors.card, ...shadows.card },
  segText: { fontSize: 14, fontWeight: 600, color: theme.colors.muted },
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
    width: "100%",
    textAlign: "left",
    ...shadows.card,
  },
  thumb: { width: 84, height: 100, borderRadius: 14, backgroundColor: theme.colors.paperDeep, flexShrink: 0 },
  rowBody: { flex: 1 },
  badge: { alignSelf: "flex-start", borderRadius: 999, padding: "2px 9px" },
  badgeText: { fontSize: 11, fontWeight: 700 },
  title: { fontSize: 15, fontWeight: 700, color: theme.colors.text, marginTop: 6, lineHeight: "20px" },
  sub: { fontSize: 12, color: theme.colors.muted, marginTop: 3 },
  supRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  sup: { fontSize: 13, fontWeight: 600, color: theme.colors.accent },
  cont: { fontSize: 12, fontWeight: 600, color: theme.colors.warning, marginTop: 6 },
});
