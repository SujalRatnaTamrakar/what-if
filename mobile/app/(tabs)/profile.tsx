/**
 * mobile/app/(tabs)/profile.tsx — S9 Profile / login (§7.5).
 * Logged out → Sign in. Logged in → editable display name, sign out,
 * app version, API mode + base URL. Dev section: fixture failure toggles
 * and the Auth0 redirect URI for the dashboard paste step.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, friendlyMessage, getFixtureFailure, setFixtureFailure } from "../../src/api";
import type { FixtureFailure } from "../../src/api";
import { useAuth } from "../../src/auth/AuthProvider";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { EmptyState } from "../../src/components/EmptyState";
import { AppHeader } from "../../src/components/AppHeader";
import { config } from "../../src/config";
import { theme } from "../../src/theme";

export default function ProfileScreen() {
  const { isLoggedIn, isLoading, user, login, logout, redirectUri } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<FixtureFailure>(getFixtureFailure());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Welcome to PlacePatch"
          message="Sign in to create proposals and support your neighbors."
          actionLabel="Sign in"
          onAction={() => void login()}
        />
      </View>
    );
  }

  const name = displayName ?? user.displayName;

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 40) {
      showToast("Name must be 1–40 characters.");
      return;
    }
    if (trimmed === user.displayName) return;
    setSaving(true);
    try {
      const updated = await api.updateMe({ displayName: trimmed });
      qc.setQueryData(["me"], updated);
      setDisplayName(updated.displayName);
      showToast("Saved");
    } catch (e) {
      showToast(
        e instanceof ApiError ? friendlyMessage(e.code) : "Couldn't save."
      );
    } finally {
      setSaving(false);
    }
  };

  const setFailureMode = (f: FixtureFailure) => {
    setFixtureFailure(f);
    setFailure(f);
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerWrap}>
          <AppHeader />
        </View>
        <Text style={styles.heading}>Profile</Text>

        <Text style={styles.label}>Display name</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={[styles.input, styles.nameInput]}
            value={name}
            onChangeText={setDisplayName}
            maxLength={40}
            accessibilityLabel="Display name"
          />
          <PrimaryButton
            title="Save"
            onPress={saveName}
            disabled={saving || name.trim() === user.displayName}
            loading={saving}
            variant="secondary"
            style={styles.saveBtn}
          />
        </View>

        <InfoRow label="App version" value={config.appVersion} />
        <InfoRow label="API mode" value={config.apiMode} />
        <InfoRow label="API base URL" value={config.apiBaseUrl} />

        <PrimaryButton
          title="Sign out"
          onPress={() => void logout()}
          variant="secondary"
          style={styles.signOut}
        />

        {__DEV__ ? (
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>Developer</Text>
            <Text style={styles.devLabel}>Fixture failure simulation</Text>
            <View style={styles.devRow}>
              {(
                [
                  [null, "Off"],
                  ["scene", "Fail scene"],
                  ["render", "Fail render"],
                ] as [FixtureFailure, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={label}
                  onPress={() => setFailureMode(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: failure === value }}
                  style={[
                    styles.devChip,
                    failure === value && styles.devChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.devChipText,
                      failure === value && styles.devChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.devLabel}>Auth0 redirect URI</Text>
            <Text style={styles.devNote}>
              Paste this into the Auth0 dashboard → Applications → PlacePatch
              Mobile → Allowed Callback URLs:
            </Text>
            <Text selectable style={styles.uri}>
              {redirectUri}
            </Text>
          </View>
        ) : null}
        <View style={{ height: 40 }} />
      </ScrollView>
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  content: { padding: theme.spacing.l, paddingBottom: 0 },
  headerWrap: { marginBottom: 4 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  heading: {
    fontSize: theme.fontSize.xxl,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: theme.spacing.m,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: theme.spacing.s,
    marginBottom: 4,
  },
  nameRow: { flexDirection: "row", alignItems: "center" },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.m,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text,
  },
  nameInput: { flex: 1, marginRight: theme.spacing.s },
  saveBtn: { minHeight: 48, paddingHorizontal: 16 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: { fontSize: 14, color: theme.colors.muted },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: "600",
    maxWidth: "60%",
  },
  signOut: { marginTop: theme.spacing.l },
  devSection: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.m,
    padding: theme.spacing.m,
  },
  devTitle: {
    fontSize: theme.fontSize.m,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: theme.spacing.s,
  },
  devLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: theme.spacing.s,
    marginBottom: 6,
  },
  devRow: { flexDirection: "row", flexWrap: "wrap" },
  devChip: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  devChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  devChipText: { fontSize: 13, fontWeight: "600", color: theme.colors.muted },
  devChipTextActive: { color: theme.colors.accent },
  devNote: { fontSize: 12, color: theme.colors.muted, marginBottom: 6, lineHeight: 17 },
  uri: {
    fontSize: 12,
    fontFamily: "monospace",
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.s,
    padding: 10,
  },
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
