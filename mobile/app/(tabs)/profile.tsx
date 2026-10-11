/**
 * mobile/app/(tabs)/profile.tsx — S9 Profile / login (§7.5).
 * Logged out → Sign in pitch. Logged in → identity card with impact stats,
 * editable display name, "How WhatIf works", AI services in use (from
 * /config), sign out. Dev section: API mode/base URL, fixture failure
 * toggles and the Auth0 redirect URI for the dashboard paste step.
 */
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text } from "../../src/components/Text";
import { Display } from "../../src/ui/Display";
import { Button } from "../../src/ui/Button";
import { Chip } from "../../src/ui/Chip";
import { Field } from "../../src/ui/Field";
import { useToast } from "../../src/ui/Toast";
import { api, ApiError, friendlyMessage, displayMessage, getFixtureFailure, setFixtureFailure } from "../../src/api";
import type { FixtureFailure } from "../../src/api";
import { useAuth } from "../../src/auth/AuthProvider";
import { useFeed } from "../../src/hooks/useFeed";
import { EmptyState } from "../../src/components/EmptyState";
import { BookIcon, ChevronRightIcon, LogoutIcon, PeopleIcon, SparkleIcon, UserIcon } from "../../src/components/icons";
import { config } from "../../src/config";
import { formatDate } from "../../src/lib/format";
import { useTopInset } from "../../src/lib/useTopInset";
import { shadows, theme } from "../../src/theme";

function Row({ icon, label, value, onPress }: { icon: React.ReactNode; label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.7 }]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={2}>
            {value}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRightIcon size={18} color={theme.colors.faint} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const top = useTopInset();
  const toast = useToast();
  const { isLoggedIn, isLoading, user, login, logout, redirectUri } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<FixtureFailure>(getFixtureFailure());
  const mine = useFeed("mine", 20, isLoggedIn);
  const cfg = useQuery({ queryKey: ["config"], queryFn: () => api.getConfig(), staleTime: 60_000, retry: false });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <View style={[styles.center, { paddingTop: top }]}>
        <EmptyState
          title="Welcome to WhatIf"
          message="Sign in to imagine changes to your neighborhood, support your neighbors' ideas, and download request packets."
          actionLabel="Sign in"
          onAction={() => void login()}
        />
        <Pressable onPress={() => router.push("/onboarding")} style={styles.how}>
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
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top + 16 }]} keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.idCard}>
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
      </Animated.View>

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

      <Button title="Sign out" variant="danger" onPress={() => void logout()} icon={(c) => <LogoutIcon size={18} color={c} />} style={styles.signOut} />
      <Text style={styles.version}>WhatIf {config.appVersion}</Text>

      {__DEV__ ? (
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
          <Text style={styles.devLabel}>Auth0 redirect URI (Allowed Callback URLs)</Text>
          <Text selectable style={styles.uri}>
            {redirectUri}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  how: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
  howText: { color: theme.colors.accent, fontWeight: "600" },
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
  avatarText: { fontSize: 30, fontWeight: "700", color: theme.colors.accentDark },
  name: { marginTop: 12, textAlign: "center" },
  since: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  stats: { flexDirection: "row", marginTop: 18, alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "700" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  section: { fontSize: 13, fontWeight: "700", color: theme.colors.muted, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 26, marginBottom: 10 },
  saveBtn: { alignSelf: "flex-start", marginTop: 2 },
  group: { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, paddingHorizontal: 14, ...shadows.card },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, paddingVertical: 10 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.colors.accentSoft, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  rowValue: { fontSize: 12, color: theme.colors.muted, marginTop: 1, lineHeight: 17 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginLeft: 48 },
  signOut: { marginTop: 26 },
  version: { textAlign: "center", fontSize: 12, color: theme.colors.faint, marginTop: 12 },
  dev: { marginTop: 26, padding: 14, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, borderStyle: "dashed" },
  devTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.muted, marginBottom: 4 },
  devLabel: { fontSize: 12, color: theme.colors.muted, marginTop: 10, marginBottom: 6 },
  devRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  uri: { fontSize: 12, color: theme.colors.text, backgroundColor: theme.colors.paperDeep, padding: 10, borderRadius: 10 },
});
