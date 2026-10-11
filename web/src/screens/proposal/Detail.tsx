/**
 * web/src/screens/proposal/Detail.tsx — S6 Proposal detail (§7.5).
 * Before/after (intro sweep, hold to compare), editorial title, author +
 * date, place (+distance, open in Maps), recipient, request text,
 * idempotent Support with a live count, request packet download (opens the
 * PDF in a new tab), share, and a "How this was made" AI transparency card.
 * Desktop (§12): slider and text side by side.
 */
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { COLUMN, CenterSpinner, Pressable, Text, View, styleSheet, useWide } from "../../ui/primitives";
import { Display } from "../../ui/Display";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { api, ApiError, displayMessage } from "../../api";
import { config } from "../../config";
import { useProposal } from "../../hooks/useProposal";
import { BeforeAfterSlider } from "../../components/BeforeAfterSlider";
import { SupportButton } from "../../components/SupportButton";
import { ErrorState } from "../../components/ErrorState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { formatDate } from "../../lib/format";
import { hrefForProposal, routeForProposal } from "../../lib/routeForProposal";
import { distanceKm, formatDistance, useProposalLocations, useUserLocation } from "../../lib/places";
import { shareText, useRouter } from "../../lib/nav";
import { BankIcon, ChevronRightIcon, DownloadIcon, PinIcon, ShareIcon, ShieldIcon, SparkleIcon } from "../../components/icons";
import { theme } from "../../theme";

const WIDE_MAX = 1100;

function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

export default function ProposalDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const pid = id as string;
  const toast = useToast();
  const router = useRouter();
  const wide = useWide();
  const { data: p, isLoading, error, refetch } = useProposal(pid);
  const [downloading, setDownloading] = useState(false);
  const me = useUserLocation(true);
  const { locations } = useProposalLocations(p ? [{ id: p.id, placeLabel: p.placeLabel }] : []);

  if (isLoading) return <CenterSpinner />;
  if (error || !p) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Proposal" />
        <View style={{ padding: 20, width: "100%", maxWidth: COLUMN, alignSelf: "center" }}>
          <ErrorState error={error} onRetry={() => refetch()} />
        </View>
      </View>
    );
  }

  const at = locations[p.id];
  const distance = at && me.coords ? formatDistance(distanceKm(me.coords, at)) : null;

  const share = async () => {
    const r = await shareText(
      `What if? ${p.title || "A neighborhood idea"} — ${p.placeLabel}. ${p.supportCount} neighbor${p.supportCount === 1 ? "" : "s"} support it on WhatIf.`,
      `${window.location.origin}/proposal/${pid}`
    );
    if (r === "copied") toast.show("Link copied", "success");
    else if (r === "failed") toast.show("Couldn't share.", "error");
  };

  const openInMaps = () => {
    const query = at ? `${at.latitude},${at.longitude}` : encodeURIComponent(p.placeLabel);
    // "noopener" makes window.open return null, so there is no failure signal.
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener");
  };

  const downloadPacket = async () => {
    setDownloading(true);
    try {
      const packet = await api.exportPacket(pid);
      if (config.apiMode === "fixture") {
        toast.show("Packet download needs the live backend.", "error");
      } else {
        window.open(packet.url, "_blank", "noopener");
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

  const slider = p.concept ? (
    <BeforeAfterSlider
      beforeUri={p.source.url}
      afterUri={p.concept.url}
      aspectRatio={wide ? p.source.width / p.source.height : Math.max(0.8, p.source.width / p.source.height)}
      beforeLabel="Before"
      afterLabel="After"
      rounded={wide}
      intro
    />
  ) : (
    <View style={[styles.noConcept, wide && { borderRadius: theme.radius.xl }]}>
      <Text style={styles.muted}>Concept not ready yet.</Text>
    </View>
  );

  const body = (
    <View className="anim-fade-in-down" style={wide ? null : styles.pad}>
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

      <Pressable onPress={openInMaps} label={`Open ${p.placeLabel} in Maps`} feedback="opacity" style={styles.metaRow}>
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
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Proposal"
        maxWidth={wide ? WIDE_MAX : COLUMN}
        right={
          <Pressable onPress={() => void share()} label="Share proposal" feedback="bg" style={styles.iconBtn}>
            <ShareIcon size={21} color={theme.colors.text} />
          </Pressable>
        }
      />
      <View className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {wide ? (
          <View style={styles.wideRow}>
            <View style={styles.wideLeft}>{slider}</View>
            <View style={styles.wideRight}>{body}</View>
          </View>
        ) : (
          <View style={styles.content}>
            {slider}
            {body}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = styleSheet({
  screen: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  content: { width: "100%", maxWidth: COLUMN, alignSelf: "center", paddingBottom: 48 },
  wideRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 36,
    width: "100%",
    maxWidth: WIDE_MAX,
    alignSelf: "center",
    padding: "8px 24px 48px",
  },
  wideLeft: { flex: 1.2, position: "sticky", top: 8 },
  wideRight: { flex: 1 },
  pad: { paddingLeft: 20, paddingRight: 20 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  noConcept: { height: 200, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.paperDeep },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.orangeSoft,
    borderRadius: 999,
    padding: "5px 12px",
    marginTop: 16,
  },
  statusText: { fontSize: 12, fontWeight: 600, color: theme.colors.warning },
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
  avatarText: { fontSize: 16, fontWeight: 700, color: "#fff" },
  byline: { fontSize: 15, color: theme.colors.text, fontWeight: 600 },
  date: { fontSize: 12, color: theme.colors.muted },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 10, minHeight: 28, width: "100%" },
  metaText: { fontSize: 14, color: theme.colors.muted, flex: 1, lineHeight: "20px" },
  distance: { color: theme.colors.accent, fontWeight: 600 },
  description: { fontSize: 16, color: theme.colors.text, lineHeight: "25px", marginTop: 16 },
  muted: { color: theme.colors.muted, fontSize: 14 },
  supportWrap: { marginTop: 22 },
  packetBtn: { marginTop: 12 },
  packetNote: { fontSize: 12, color: theme.colors.muted, textAlign: "center", marginTop: 8 },
  continueBtn: { marginTop: 14 },
  made: { marginTop: 26, backgroundColor: theme.colors.paperDeep, borderRadius: theme.radius.xl, padding: 16, gap: 6 },
  madeHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  madeTitle: { fontSize: 14, fontWeight: 700, color: theme.colors.accentDark },
  madeRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  madeLine: { fontSize: 13, color: theme.colors.muted, lineHeight: "19px", flexShrink: 1 },
});
