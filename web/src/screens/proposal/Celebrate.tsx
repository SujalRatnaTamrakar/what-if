/**
 * web/src/screens/proposal/Celebrate.tsx — published! Confetti, the final
 * before/after, and the next moves: share it, view it, start another.
 */
import React from "react";
import { useParams } from "react-router-dom";
import { Pressable, Text, View, styleSheet } from "../../ui/primitives";
import { Display } from "../../ui/Display";
import { Button } from "../../ui/Button";
import { Confetti } from "../../ui/Confetti";
import { useToast } from "../../ui/Toast";
import { BeforeAfterSlider } from "../../components/BeforeAfterSlider";
import { CheckIcon, ShareIcon } from "../../components/icons";
import { useProposal } from "../../hooks/useProposal";
import { shareText, useRouter } from "../../lib/nav";
import { shadows, theme } from "../../theme";

export default function Celebrate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: p } = useProposal(id);

  const share = async () => {
    const r = await shareText(
      `What if? ${p?.title ?? "A neighborhood idea"} — ${p?.placeLabel ?? ""}. Support it on WhatIf.`,
      `${window.location.origin}/proposal/${id}`
    );
    if (r === "copied") toast.show("Link copied", "success");
    else if (r === "failed") toast.show("Couldn't share.", "error");
  };

  return (
    <View style={styles.root}>
      <Confetti />
      <View className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <View style={styles.inner}>
          <View className="anim-zoom-in" style={styles.badge}>
            <CheckIcon size={34} color="#fff" strokeWidth={3} />
          </View>
          <View className="anim-fade-in-down" style={[styles.center, { animationDelay: "150ms" }]}>
            <Display size={32} style={styles.title}>
              It's live.
            </Display>
            <Display size={20} italic color={theme.colors.accent} style={styles.sub}>
              Now rally your neighbors.
            </Display>
          </View>

          {p?.concept ? (
            <View className="anim-fade-in-down" style={[styles.card, { animationDelay: "300ms" }]}>
              <BeforeAfterSlider
                beforeUri={p.source.url}
                afterUri={p.concept.url}
                aspectRatio={p.source.width / p.source.height}
                beforeLabel="Before"
                afterLabel="After"
                rounded
                intro
              />
              <Text style={styles.cardTitle} lines={2}>
                {p.title}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button title="Share with neighbors" onPress={() => void share()} icon={(c) => <ShareIcon size={18} color={c} />} />
            <Button title="View proposal" variant="secondary" onPress={() => router.replace(`/proposal/${id}`)} />
            <Pressable onPress={() => router.replace("/")} feedback="opacity" style={styles.linkBtn}>
              <Text style={styles.link}>Back to community</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = styleSheet({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background, overflow: "hidden" },
  inner: {
    minHeight: "100%",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    alignItems: "center",
    padding: "24px 24px 16px",
    position: "relative",
    zIndex: 6,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lift,
  },
  center: { alignItems: "center" },
  title: { marginTop: 18, textAlign: "center" },
  sub: { marginTop: 4, textAlign: "center" },
  card: {
    width: "72%",
    maxWidth: 300,
    marginTop: 22,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 10,
    ...shadows.card,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: theme.colors.text, marginTop: 10, marginLeft: 4, marginRight: 4 },
  actions: { width: "100%", gap: 10, marginTop: "auto", paddingTop: 18 },
  linkBtn: { alignItems: "center", padding: 10, borderRadius: 999 },
  link: { textAlign: "center", color: theme.colors.muted, fontWeight: 600 },
});
