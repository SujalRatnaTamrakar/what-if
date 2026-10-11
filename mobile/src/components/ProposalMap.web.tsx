/**
 * mobile/src/components/ProposalMap.web.tsx — web build has no native map;
 * show an honest placeholder (the list below the map still works).
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { MapIcon } from "./icons";
import type { ProposalSummary } from "../api/types";
import type { LatLng } from "../lib/places";
import { theme } from "../theme";

export interface MapPin {
  item: ProposalSummary;
  at: LatLng;
}

export function ProposalMap(_props: {
  pins: MapPin[];
  user: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focus?: LatLng | null;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]}>
      <MapIcon size={40} color={theme.colors.accent} />
      <Text style={styles.text}>The map runs in the iOS and Android app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.accentSoft },
  text: { marginTop: 10, color: theme.colors.accentDark, fontWeight: "600" },
});
