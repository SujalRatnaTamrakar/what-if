/**
 * web/src/screens/Profile.tsx — S9 Profile / login (§7.5).
 * Logged out → Sign in pitch. Logged in → identity card with impact stats,
 * editable display name, "How WhatIf works", AI services in use (from
 * /config), sign out. Dev section: API mode/base URL, fixture failure
 * toggles and the Auth0 callback URL for the dashboard paste step.
 */
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { COLUMN, CenterSpinner, Pressable, Text, View, styleSheet } from "../ui/primitives";
import { Display } from "../ui/Display";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { api, ApiError, displayMessage, getFixtureFailure, setFixtureFailure } from "../api";
import type { FixtureFailure } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { useFeed } from "../hooks/useFeed";
import { EmptyState } from "../components/EmptyState";
import { BookIcon, ChevronRightIcon, LogoutIcon, PeopleIcon, SparkleIcon, UserIcon } from "../components/icons";
import { config } from "../config";
import { formatDate } from "../lib/format";
import { useRouter } from "../lib/nav";
import { shadows, theme } from "../theme";

function Row({ icon, label, value, onPress }: { icon: React.ReactNode; label: string; value?: string; onPress?: () => void }) {
  const body = (
    <>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? (
          <Text style={styles.rowValue} lines={2}>
            {value}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRightIcon size={18} color={theme.colors.faint} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} feedback="opacity" style={[styles.row, { width: "100%", textAlign: "left" }]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.row}>{body}</View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { isLoggedIn, isLoading, user, login, logout, redirectUri } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<FixtureFailure>(getFixtureFailure());
  const mine = useFeed("mine", 20, isLoggedIn);
  const cfg = useQuery({ queryKey: ["config"], queryFn: () => api.getConfig(), staleTime: 60_000, retry: false });

  if (isLoading) return <CenterSpinner />;

  if (!isLoggedIn || !user) {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Welcome to WhatIf"
          message="Sign in to imagine changes to your neighborhood, support your neighbors' ideas, and download request packets."
          actionLabel="Sign in"
          onAction={() => void login()}
        />
        <Pressable onPress={() => router.push("/onboarding")} feedback="opacity" style={styles.how}>
          <BookIcon size={16} color={theme.colors.accent} />
          <Text style={styles.howText}>How WhatIf works</Text>
        </Pressable>
      </View>
    );
  }

  const name = displayName ?? user.displayName;
  const items = mine.data?.pages.flatMap((p) => p.items) ?? [];
  const published = items.filter((i) => i.status === "published");
  const supporters = published.reduce((n, i) => n + i.supportCount, 0);

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 40) {
      toast.show("Name must be 1–40 characters.", "error");
      return;
    }
    if (trimmed === user.displayName) return;
    setSaving(true);
    try {
      const updated = await api.updateMe({ displayName: trimmed });
      qc.setQueryData(["me"], updated);
      setDisplayName(updated.displayName);
      toast.show("Name saved", "success");
    } catch (e) {
      toast.show(e instanceof ApiError ? displayMessage(e) : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const setFailureMode = (f: FixtureFailure) => {
    setFixtureFailure(f);
    setFailure(f);
  };

  const providers = cfg.data?.providers;

  return (
    <View className="scroll" style={styles.screen}>
      <View style={styles.content}>
        <View className="anim-fade-in-down" style={styles.idCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.displayName.trim()[0] ?? "?").toUpperCase()}</Text>
          </View>
          <Display size={26} color="#fff" style={styles.name}>
            {user.displayName}
          </Display>
          <Text style={styles.since}>Neighbor since {formatDate(user.createdAt)}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{items.length}</Text>
              <Text style={styles.statLabel}>Ideas</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{published.length}</Text>
              <Text style={styles.statLabel}>Published</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{supporters}</Text>
              <Text style={styles.statLabel}>Supporters</Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Your name</Text>
        <Field label="Display name" value={name} onChangeText={setDisplayName} maxLength={40} />
        {name.trim() !== user.displayName ? (
          <Button title="Save name" variant="soft" size="m" onPress={() => void saveName()} loading={saving} style={styles.saveBtn} />
        ) : null}

        <Text style={styles.section}>WhatIf</Text>
        <View style={styles.group}>
          <Row icon={<BookIcon size={18} color={theme.colors.accent} />} label="How WhatIf works" onPress={() => router.push("/onboarding")} />
          <View style={styles.sep} />
          <Row
            icon={<SparkleIcon size={18} color={theme.colors.accent} />}
            label="AI in use"
            value={providers ? `Scene: ${providers.scene} · Image: ${providers.render} · Review: ${providers.review}` : "Loading…"}
          />
          <View style={styles.sep} />
          <Row
            icon={<PeopleIcon size={18} color={theme.colors.accent} />}
            label="Honest by design"
            value="AI images are always labeled. Supports count once per person."
          />
        </View>

        <Button
          title="Sign out"
          variant="danger"
          onPress={() => void logout()}
          icon={(c) => <LogoutIcon size={18} color={c} />}
          style={styles.signOut}
        />
        <Text style={styles.version}>WhatIf {config.appVersion}</Text>

        {config.isDev ? (
          <View style={styles.dev}>
            <Text style={styles.devTitle}>Developer</Text>
            <Row icon={<UserIcon size={18} color={theme.colors.muted} />} label="API" value={`${config.apiMode} · ${config.apiBaseUrl}`} />
            {config.apiMode === "fixture" ? (
              <>
                <Text style={styles.devLabel}>Fixture failure simulation</Text>
                <View style={styles.devRow}>
                  {(
                    [
                      [null, "Off"],
                      ["scene", "Fail scene"],
                      ["render", "Fail render"],
                    ] as [FixtureFailure, string][]
                  ).map(([value, label]) => (
                    <Chip key={label} label={label} active={failure === value} onPress={() => setFailureMode(value)} accessibilityRole="radio" />
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.devLabel}>Auth0 callback URL (SPA app: Allowed Callback, Logout and Web Origins)</Text>
            <Text style={styles.uri}>{redirectUri}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = styleSheet({
  screen: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  center: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  content: { paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 48, width: "100%", maxWidth: COLUMN, alignSelf: "center" },
  how: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
  howText: { color: theme.colors.accent, fontWeight: 600 },
  idCard: { backgroundColor: theme.colors.accentDark, borderRadius: 26, padding: 22, alignItems: "center", ...shadows.lift },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatarText: { fontSize: 30, fontWeight: 700, color: theme.colors.accentDark },
  name: { marginTop: 12, textAlign: "center" },
  since: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  stats: { flexDirection: "row", marginTop: 18, alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontWeight: 700 },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  section: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.colors.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 26,
    marginBottom: 10,
  },
  saveBtn: { alignSelf: "flex-start", marginTop: 2 },
  group: { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, paddingLeft: 14, paddingRight: 14, ...shadows.card },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, paddingTop: 10, paddingBottom: 10 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 15, fontWeight: 600, color: theme.colors.text },
  rowValue: { fontSize: 12, color: theme.colors.muted, marginTop: 1, lineHeight: "17px" },
  sep: { height: 1, backgroundColor: theme.colors.border, marginLeft: 48 },
  signOut: { marginTop: 26 },
  version: { textAlign: "center", fontSize: 12, color: theme.colors.faint, marginTop: 12 },
  dev: {
    marginTop: 26,
    padding: 14,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  devTitle: { fontSize: 13, fontWeight: 700, color: theme.colors.muted, marginBottom: 4 },
  devLabel: { fontSize: 12, color: theme.colors.muted, marginTop: 10, marginBottom: 6 },
  devRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  uri: {
    fontSize: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.paperDeep,
    padding: 10,
    borderRadius: 10,
    userSelect: "all",
  },
});
