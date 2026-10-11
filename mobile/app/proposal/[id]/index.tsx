/**
 * mobile/app/proposal/[id]/index.tsx — S6 Proposal detail (§7.5) in the
 * mockup visual language. Before/after header, bold title, author row with
 * avatar, location row, bank icon + recipient, description, support pill,
 * outlined packet download button.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import { Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api, ApiError, friendlyMessage } from "../../../src/api";
import { config } from "../../../src/config";
import { useProposal } from "../../../src/hooks/useProposal";
import { BeforeAfterSlider } from "../../../src/components/BeforeAfterSlider";
import { SupportButton } from "../../../src/components/SupportButton";
import { ErrorState } from "../../../src/components/ErrorState";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { theme } from "../../../src/theme";
import { formatDate } from "../../../src/lib/format";
import { hrefForProposal, routeForProposal } from "../../../src/lib/routeForProposal";
import { BankIcon, DownloadIcon, PinIcon } from "../../../src/components/icons";

function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

export default function ProposalDetailScreen() {
  const { id } = useLocalSearchParams();
  const pid = Array.isArray(id) ? id[0] : (id as string);
  const { data: p, isLoading, error, refetch } = useProposal(pid);
  const [downloading, setDownloading] = useState(false);
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
  if (error || !p) {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <ErrorState error={error} onRetry={() => refetch()} />
      </View>
    );
  }

  const downloadPacket = async () => {
    setDownloading(true);
    try {
      const packet = await api.exportPacket(pid);
      const target = `${Paths.cache.uri}placepatch-${pid}.pdf`;
      const { uri } = await FileSystem.downloadAsync(packet.url, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        showToast("Packet downloaded.");
      }
    } catch (e) {
      showToast(
        config.apiMode === "fixture"
          ? "Packet download needs the live backend."
          : e instanceof ApiError
            ? friendlyMessage(e.code)
            : "Couldn't download."
      );
    } finally {
      setDownloading(false);
    }
  };

  const showContinue = p.author.isViewer && p.status !== "published";

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        {p.concept ? (
          <BeforeAfterSlider
            beforeUri={p.source.url}
            afterUri={p.concept.url}
            aspectRatio={p.source.width / p.source.height}
            beforeLabel="Before"
            afterLabel="After"
          />
        ) : (
          <Text style={styles.muted}>Concept not ready yet.</Text>
        )}

        <Text style={styles.title}>{p.title || "Untitled proposal"}</Text>

        <View style={styles.authorRow}>
          <Avatar name={p.author.displayName} />
          <Text style={styles.byline}>by {p.author.displayName}</Text>
        </View>

        <View style={styles.metaRow}>
          <PinIcon size={16} color={theme.colors.muted} />
          <Text style={styles.metaText}>{p.placeLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <BankIcon size={16} color={theme.colors.muted} />
          <Text style={styles.metaText}>Recipient: {p.recipientLabel}</Text>
        </View>
        {p.publishedAt ? (
          <Text style={styles.date}>Published {formatDate(p.publishedAt)}</Text>
        ) : null}

        <Text style={styles.description}>{p.changeRequest || p.problemText}</Text>

        <Text style={styles.disclosure}>✦ {p.aiDisclosure}</Text>

        <View style={styles.supportWrap}>
          <SupportButton proposal={p} />
        </View>

        <Pressable
          onPress={downloadPacket}
          disabled={downloading}
          accessibilityRole="button"
          accessibilityLabel="Download request packet"
          style={({ pressed }) => [
            styles.packetBtn,
            pressed && styles.pressed,
            downloading && styles.busy,
          ]}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <View style={styles.packetInner}>
              <DownloadIcon size={18} color={theme.colors.accent} />
              <Text style={styles.packetText}>Download request packet</Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.packetNote}>
          Downloading doesn't send this anywhere.
        </Text>

        {showContinue ? (
          <PrimaryButton
            title="Continue editing"
            onPress={() =>
              router.push(hrefForProposal(p.id, routeForProposal(p)))
            }
            variant="secondary"
            style={styles.continueBtn}
          />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  content: { padding: theme.spacing.l, paddingBottom: 0 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  back: { paddingVertical: theme.spacing.s, alignSelf: "flex-start" },
  backText: { fontSize: 16, color: theme.colors.accent, fontWeight: "600" },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: theme.spacing.m,
    lineHeight: 30,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.s,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.accent,
  },
  byline: { fontSize: 15, color: theme.colors.text, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  metaText: { fontSize: 14, color: theme.colors.muted, marginLeft: 6, flex: 1 },
  date: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
  description: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 23,
    marginTop: theme.spacing.m,
  },
  muted: { color: theme.colors.muted, fontSize: 14 },
  disclosure: {
    fontSize: 13,
    color: theme.colors.muted,
    fontStyle: "italic",
    marginTop: theme.spacing.m,
  },
  supportWrap: { marginTop: theme.spacing.l },
  packetBtn: {
    marginTop: theme.spacing.m,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  packetInner: { flexDirection: "row", alignItems: "center" },
  packetText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.accent,
    marginLeft: 8,
  },
  pressed: { opacity: 0.75 },
  busy: { opacity: 0.6 },
  packetNote: {
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: 6,
  },
  continueBtn: { marginTop: theme.spacing.m },
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
