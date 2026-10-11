/**
 * web/src/screens/Onboarding.tsx — first-visit story (3 pages): imagine with
 * a live before/after made by WhatIf's own pipeline, brush the change, rally
 * neighbors. Skippable; reopenable from Profile → "How WhatIf works".
 * Swipe/scroll between pages, or use Next / arrow keys.
 */
import React, { useEffect, useRef, useState } from "react";
import { Img, Pressable, Text, View, absoluteFill, styleSheet } from "../ui/primitives";
import { Display } from "../ui/Display";
import { Button } from "../ui/Button";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { PeopleIcon, DownloadIcon, SproutIcon } from "../components/icons";
import { Wordmark } from "../components/Wordmark";
import { markOnboardingSeen } from "../lib/onboarding";
import { useRouter } from "../lib/nav";
import { shadows, theme } from "../theme";
import BEFORE from "../assets/demo/before.jpg";
import AFTER from "../assets/demo/after.jpg";

export default function Onboarding() {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const finish = async () => {
    await markOnboardingSeen();
    router.replace("/");
  };

  const go = (p: number) => scroller.current?.scrollTo({ left: p * width, behavior: "smooth" });

  const next = () => {
    if (page >= 2) return void finish();
    go(page + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(Math.min(2, page + 1));
      if (e.key === "ArrowLeft") go(Math.max(0, page - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !width) return;
    const p = Math.round(el.scrollLeft / width);
    if (p !== page) setPage(p);
  };

  const pageW = Math.min(width, 520);
  const art = Math.max(0, pageW - 64);
  const pageStyle = [styles.page, { width: width || "100%" }];

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <SproutIcon size={28} />
          <Wordmark size={23} style={{ marginLeft: 6 }} />
        </View>
        {page < 2 ? (
          <Pressable onPress={() => void finish()} feedback="opacity" style={{ padding: 8 }}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <View ref={scroller} className="hscroll" onScroll={onScroll} style={styles.pager}>
        {/* 1 — Imagine */}
        <View style={pageStyle} aria-hidden={page !== 0}>
          <View style={[styles.artCard, { width: art }]}>
            <BeforeAfterSlider
              beforeUri={BEFORE}
              afterUri={AFTER}
              aspectRatio={493 / 659}
              beforeLabel="Today"
              afterLabel="What if…"
              rounded
              autoplay
            />
          </View>
          <Display size={34} italic style={styles.title}>
            What if this corner had shade?
          </Display>
          <Text style={styles.body}>
            Snap a photo of a place you care about. WhatIf's AI imagines a small, realistic improvement — right in your photo.
          </Text>
        </View>

        {/* 2 — Brush */}
        <View style={pageStyle} aria-hidden={page !== 1}>
          <View style={[styles.artCard, { width: art, aspectRatio: 493 / 659 }]}>
            <Img src={BEFORE} fill />
            <svg style={{ ...absoluteFill, width: "100%", height: "100%" }} viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
              <path d="M8 36 C 25 28, 50 26, 72 32" stroke="rgba(232,163,61,0.62)" strokeWidth={14} strokeLinecap="round" fill="none" />
            </svg>
            <View style={styles.brushTagWrap}>
              <View style={styles.brushTag}>
                <Text style={styles.brushTagText}>Brush the change</Text>
              </View>
            </View>
          </View>
          <Display size={34} style={styles.title}>
            You decide where.
          </Display>
          <Text style={styles.body}>
            Brush exactly the area to change. Everything outside your brush stays as it is — and an AI reviewer checks the result for you.
          </Text>
        </View>

        {/* 3 — Rally */}
        <View style={pageStyle} aria-hidden={page !== 2}>
          <View className="anim-fade-in" style={[styles.rally, { width: art }]}>
            <View style={styles.rallyRow}>
              <View style={[styles.rallyIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <PeopleIcon size={26} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rallyTitle}>Neighbors support it</Text>
                <Text style={styles.rallySub}>One tap. Counts are honest — no double votes.</Text>
              </View>
            </View>
            <View style={styles.rallyDivider} />
            <View style={styles.rallyRow}>
              <View style={[styles.rallyIcon, { backgroundColor: theme.colors.orangeSoft }]}>
                <DownloadIcon size={24} color={theme.colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rallyTitle}>Download a request packet</Text>
                <Text style={styles.rallySub}>A tidy PDF with the before/after and your request, ready for the city.</Text>
              </View>
            </View>
          </View>
          <Display size={34} style={styles.title}>
            Small changes, rallied together.
          </Display>
          <Text style={styles.body}>
            AI images are illustrations, not engineering designs — always labeled, always yours to approve.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <Pressable key={i} onPress={() => go(i)} label={`Page ${i + 1}`} selected={page === i} feedback="none" style={{ padding: 4 }}>
              <View style={[styles.dot, page === i && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        <Button title={page === 2 ? "Get started" : "Next"} onPress={next} style={styles.cta} />
      </View>
    </View>
  );
}

const styles = styleSheet({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.background,
    paddingTop: 8,
    paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 22,
    paddingRight: 22,
    height: 44,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  brand: { flexDirection: "row", alignItems: "center" },
  skip: { fontSize: 15, color: theme.colors.muted, fontWeight: 600 },
  pager: { flex: 1, minHeight: 0, flexDirection: "row", scrollSnapType: "x mandatory", overflowY: "auto" },
  page: { alignItems: "center", paddingLeft: 32, paddingRight: 32, paddingTop: 12, scrollSnapAlign: "start", scrollSnapStop: "always" },
  artCard: {
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    maxHeight: 400,
    maxWidth: 300,
    backgroundColor: theme.colors.paperDeep,
    ...shadows.lift,
  },
  title: { textAlign: "center", marginTop: 26, maxWidth: 420 },
  body: { fontSize: 15, lineHeight: "23px", color: theme.colors.muted, textAlign: "center", marginTop: 12, maxWidth: 400 },
  brushTagWrap: { position: "absolute", bottom: 12, left: 0, right: 0, alignItems: "center" },
  brushTag: { backgroundColor: theme.colors.accent, borderRadius: 999, padding: "7px 14px" },
  brushTagText: { color: "#fff", fontWeight: 600, fontSize: 13 },
  rally: { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, padding: 20, maxWidth: 420, ...shadows.card },
  rallyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  rallyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rallyTitle: { fontSize: 16, fontWeight: 700, color: theme.colors.text },
  rallySub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, lineHeight: "19px" },
  rallyDivider: { height: 1, backgroundColor: theme.colors.border, marginTop: 16, marginBottom: 16 },
  footer: { paddingLeft: 24, paddingRight: 24, alignItems: "center", paddingTop: 12 },
  dots: { flexDirection: "row", gap: 0, marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.border, transition: "width 220ms ease, background-color 220ms ease" },
  dotOn: { width: 24, backgroundColor: theme.colors.accent },
  cta: { alignSelf: "stretch", maxWidth: 480, width: "100%", marginLeft: "auto", marginRight: "auto" },
});
