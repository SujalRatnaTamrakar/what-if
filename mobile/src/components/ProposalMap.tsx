/**
 * mobile/src/components/ProposalMap.tsx — native map of proposals
 * (react-native-maps: Apple Maps on iOS, Google on Android). Pins are the
 * proposal's concept thumbnail in a sprout-green frame.
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { Image } from "expo-image";
import type { ProposalSummary } from "../api/types";
import type { LatLng } from "../lib/places";
import { theme } from "../theme";

export interface MapPin {
  item: ProposalSummary;
  at: LatLng;
}

interface Props {
  pins: MapPin[];
  user: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focus?: LatLng | null;
}

function regionFor(points: LatLng[]): Region {
  if (points.length === 0) {
    // Atlanta, where the demo lives.
    return { latitude: 33.7756, longitude: -84.3963, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.6),
  };
}

export function ProposalMap({ pins, user, selectedId, onSelect, focus }: Props) {
  const ref = useRef<MapView>(null);
  const initial = regionFor([...pins.map((p) => p.at), ...(user ? [user] : [])]);

  useEffect(() => {
    if (focus) ref.current?.animateToRegion({ ...focus, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 450);
  }, [focus]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={initial}
      showsUserLocation={!!user}
      showsPointsOfInterests={false}
      onPress={() => onSelect(null)}
      accessibilityLabel="Map of proposals"
    >
      {pins.map(({ item, at }) => {
        const selected = item.id === selectedId;
        return (
          <Marker
            key={item.id}
            coordinate={at}
            onPress={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
            tracksViewChanges={false}
            accessibilityLabel={item.title}
          >
            <View style={[styles.pin, selected && styles.pinSelected]}>
              <Image
                source={{ uri: item.conceptThumbUrl ?? item.sourceThumbUrl }}
                style={styles.thumb}
                contentFit="cover"
              />
            </View>
            <View style={[styles.tail, selected && styles.tailSelected]} />
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: theme.colors.accent,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  pinSelected: { borderColor: theme.colors.orange, transform: [{ scale: 1.15 }] },
  thumb: { width: "100%", height: "100%" },
  tail: {
    alignSelf: "center",
    width: 10,
    height: 10,
    marginTop: -5,
    backgroundColor: theme.colors.accent,
    transform: [{ rotate: "45deg" }],
  },
  tailSelected: { backgroundColor: theme.colors.orange },
});
