/**
 * web/src/components/SupportButton.tsx — idempotent support (§7.5 S6).
 * Uses useSupport: optimistic +1, then the SERVER value replaces it, so a
 * double-click never shows count + 2. Logged-out clicks route to sign-in.
 */
import React from "react";
import { Pressable, Text, styleSheet } from "../ui/primitives";
import { useAuth } from "../auth/AuthProvider";
import { useSupport } from "../hooks/useSupport";
import { useRouter } from "../lib/nav";
import { PeopleIcon } from "./icons";
import type { Proposal } from "../api/types";
import { theme } from "../theme";

interface Props {
  proposal: Proposal;
  /** Called instead of the default sign-in routing when logged out. */
  onLoginRequired?: () => void;
}

export function SupportButton({ proposal, onLoginRequired }: Props) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const mutation = useSupport(proposal.id);
  const supported = proposal.viewerHasSupported;

  const onPress = () => {
    if (!isLoggedIn) {
      if (onLoginRequired) onLoginRequired();
      else router.push("/profile");
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate(false);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={mutation.isPending}
      selected={supported}
      busy={mutation.isPending}
      label={
        supported
          ? `You support this. ${proposal.supportCount} supporters.`
          : `Support this proposal. ${proposal.supportCount} supporters.`
      }
      feedback="scale"
      style={[styles.base, supported ? styles.supported : styles.unsupported, mutation.isPending && styles.busy]}
    >
      {supported ? <PeopleIcon size={22} color={theme.colors.accent} /> : null}
      <Text style={[styles.label, supported ? styles.labelSupported : styles.labelUnsupported, supported && { marginLeft: 10 }]}>
        {supported ? `You support this · ${proposal.supportCount}` : `Support · ${proposal.supportCount}`}
      </Text>
    </Pressable>
  );
}

const styles = styleSheet({
  base: {
    minHeight: 54,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 20,
    paddingRight: 20,
    width: "100%",
  },
  supported: { backgroundColor: theme.colors.accentSoft },
  unsupported: { backgroundColor: theme.colors.accent },
  busy: { opacity: 0.6 },
  label: { fontSize: 16, fontWeight: 700 },
  labelSupported: { color: theme.colors.accent },
  labelUnsupported: { color: "#fff" },
});
