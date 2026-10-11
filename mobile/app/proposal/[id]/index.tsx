/**
 * mobile/app/proposal/[id]/index.tsx — S6 Proposal detail (§7.5).
 * Full-bleed before/after (intro sweep, hold to compare), editorial title,
 * author + date, place (+distance, open in Maps), recipient, request text,
 * idempotent Support with a live count, request packet download (shared via
 * the OS sheet), share, and an "How this was made" AI transparency card.
 */
import React, { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text } from "../../../src/components/Text";
import { Display } from "../../../src/ui/Display";
import { Button } from "../../../src/ui/Button";
import { useToast } from "../../../src/ui/Toast";
import { api, ApiError, friendlyMessage, displayMessage } from "../../../src/api";
import { config } from "../../../src/config";
import { useProposal } from "../../../src/hooks/useProposal";
import { BeforeAfterSlider } from "../../../src/components/BeforeAfterSlider";
import { SupportButton } from "../../../src/components/SupportButton";
import { ErrorState } from "../../../src/components/ErrorState";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { formatDate } from "../../../src/lib/format";
import { hrefForProposal, routeForProposal } from "../../../src/lib/routeForProposal";
import { distanceKm, formatDistance, useProposalLocations, useUserLocation } from "../../../src/lib/places";
import {
  BankIcon,
  ChevronRightIcon,
  DownloadIcon,
  PinIcon,
  ShareIcon,
  ShieldIcon,
  SparkleIcon,
} from "../../../src/components/icons";
import { theme } from "../../../src/theme";

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
  const toast = useToast();
  const { data: p, isLoading, error, refetch } = useProposal(pid);
  const [downloading, setDownloading] = useState(false);
  const me = useUserLocation(true);
  const { locations } = useProposalLocations(p ? [{ id: p.id, placeLabel: p.placeLabel }] : []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }
  if (error || !p) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Proposal" />
        <View style={{ padding: 20 }}>
          <ErrorState error={error} onRetry={() => refetch()} />
        </View>
      </View>
    );
  }

  const at = locations[p.id];
  const distance = at && me.coords ? formatDistance(distanceKm(me.coords, at)) : null;

  const share = () =>
    void Share.share({
      message: `What if? ${p.title || "A neighborhood idea"} — ${p.placeLabel}. ${p.supportCount} neighbor${p.supportCount === 1 ? "" : "s"} support it on WhatIf.`,
    }).catch(() => {});

  const openInMaps = () => {
    const q = encodeURIComponent(p.placeLabel);
    const url = at
      ? Platform.OS === "ios"
        ? `http://maps.apple.com/?ll=${at.latitude},${at.longitude}&q=${q}`
        : `geo:${at.latitude},${at.longitude}?q=${q}`
      : Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${q}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    void Linking.openURL(url).catch(() => toast.show("Couldn't open Maps.", "error"));
  };

  const downloadPacket = async () => {
    setDownloading(true);
    try {
      const packet = await api.exportPacket(pid);
<<<<<<< Updated upstream
      const file = await File.downloadFileAsync(packet.url, new File(Paths.cache, `whatif-${pid}.pdf`), {
        idempotent: true,
      });
=======
      const target = `${Paths.cache.uri}whatif-${pid}.pdf`;
      const { uri } = await FileSystem.downloadAsync(packet.url, target);
>>>>>>> Stashed changes
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Request packet" });
      } else {
        toast.show("Packet downloaded.", "success");
      }
    } catch (e) {
      toast.show(
        config.apiMode === "fixture"
          ? "Packet download needs the live backend."
          : e instanceof ApiError
            ? displayMessage(e)
            : "Couldn't download the packet.",
        "error"
      );
    } finally {
      setDownloading(false);
    }
  };

  const showContinue = p.author.isViewer && p.status !== "published";

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Proposal"
        right={
          <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share proposal" hitSlop={8} style={styles.iconBtn}>
            <ShareIcon size={21} color={theme.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {p.concept ? (
          <BeforeAfterSlider
            beforeUri={p.source.url}
            afterUri={p.concept.url}
            aspectRatio={Math.max(0.8, p.source.width / p.source.height)}
            beforeLabel="Before"
            afterLabel="After"
            intro
          />
        ) : (
          <View style={styles.noConcept}>
            <Text style={styles.muted}>Concept not ready yet.</Text>
          </View>
        )}

        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.pad}>
          {p.status !== "published" ? (
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{p.status === "ready" ? "Ready to publish" : "Draft"} · only you can see this</Text>
            </View>
          ) : null}
          <Display size={28} style={styles.title}>
            {p.title || "Untitled proposal"}
          </Display>

          <View style={styles.authorRow}>
            <Avatar name={p.author.displayName} />
            <View>
              <Text style={styles.byline}>by {p.author.displayName}</Text>
              {p.publishedAt ? <Text style={styles.date}>Published {formatDate(p.publishedAt)}</Text> : null}
            </View>
          </View>

          <Pressable onPress={openInMaps} accessibilityRole="button" accessibilityLabel={`Open ${p.placeLabel} in Maps`} style={styles.metaRow}>
            <PinIcon size={17} color={theme.colors.muted} />
            <Text style={styles.metaText}>
              {p.placeLabel}
              {distance ? <Text style={styles.distance}>  · {distance}</Text> : null}
            </Text>
            <ChevronRightIcon size={16} color={theme.colors.faint} />
          </Pressable>
          <View style={styles.metaRow}>
            <BankIcon size={17} color={theme.colors.muted} />
            <Text style={styles.metaText}>Recipient: {p.recipientLabel}</Text>
          </View>

          <Text style={styles.description}>{p.changeRequest || p.problemText}</Text>

          <View style={styles.supportWrap}>
            <SupportButton proposal={p} />
          </View>

          <Button
            title="Download request packet"
            variant="secondary"
            onPress={() => void downloadPacket()}
            loading={downloading}
            icon={(c) => <DownloadIcon size={18} color={c} />}
            style={styles.packetBtn}
          />
          <Text style={styles.packetNote}>Downloading doesn't send this anywhere.</Text>

          {showContinue ? (
            <Button
              title="Continue editing"
              variant="soft"
              onPress={() => router.push(hrefForProposal(p.id, routeForProposal(p)))}
              style={styles.continueBtn}
            />
          ) : null}

          <View style={styles.made}>
            <View style={styles.madeHead}>
              <SparkleIcon size={16} color={theme.colors.accent} />
              <Text style={styles.madeTitle}>How this was made</Text>
            </View>
            <Text style={styles.madeLine}>{p.aiDisclosure}</Text>
            {p.scene ? <Text style={styles.madeLine}>Scene: {p.scene.summary}</Text> : null}
            {p.generation ? (
              <Text style={styles.madeLine}>
                Image: {p.generation.model} · {Math.max(1, Math.round(p.generation.durationMs / 1000))}s
              </Text>
            ) : null}
            {p.review ? (
              <View style={styles.madeRow}>
                <ShieldIcon size={15} color={theme.colors.accent} />
                <Text style={styles.madeLine}>
                  AI review: {p.review.verdict === "clear" ? "clear" : p.review.verdict === "needs_review" ? "author reviewed notes" : "blocked"} ·{" "}
                  {(100 - p.review.outsideMaskChange * 100).toFixed(1)}% of the photo unchanged
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  content: { paddingBottom: 48 },
  pad: { paddingHorizontal: 20 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  noConcept: { height: 200, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.paperDeep },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.orangeSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 16,
  },
  statusText: { fontSize: 12, fontWeight: "600", color: theme.colors.warning },
  title: { marginTop: 16 },
  authorRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  byline: { fontSize: 15, color: theme.colors.text, fontWeight: "600" },
  date: { fontSize: 12, color: theme.colors.muted },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 10, minHeight: 28 },
  metaText: { fontSize: 14, color: theme.colors.muted, flex: 1, lineHeight: 20 },
  distance: { color: theme.colors.accent, fontWeight: "600" },
  description: { fontSize: 16, color: theme.colors.text, lineHeight: 25, marginTop: 16 },
  muted: { color: theme.colors.muted, fontSize: 14 },
  supportWrap: { marginTop: 22 },
  packetBtn: { marginTop: 12 },
  packetNote: { fontSize: 12, color: theme.colors.muted, textAlign: "center", marginTop: 8 },
  continueBtn: { marginTop: 14 },
  made: { marginTop: 26, backgroundColor: theme.colors.paperDeep, borderRadius: theme.radius.xl, padding: 16, gap: 6 },
  madeHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  madeTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.accentDark },
  madeRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  madeLine: { fontSize: 13, color: theme.colors.muted, lineHeight: 19, flexShrink: 1 },
});
