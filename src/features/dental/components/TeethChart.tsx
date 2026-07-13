import { Fragment } from "react";
import { Image } from "expo-image";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import {
  ALL_CHART_TEETH,
  isDeciduousFdi,
  TOOTH_SCALE_PERM,
  TOOTH_SCALE_PRIMARY,
} from "../chartLayout";
import { getToothImageSource, type ToothImageVariant } from "../toothAssets";
import type { TeethStates } from "../types";

type Props = {
  teethStates: TeethStates;
  selectedTooth: string | null;
  onToothPress: (fdi: string) => void;
  maxWidth?: number;
};

type DisplayState = "default" | "checked" | "diagnosed" | "missing";

function displayState(
  fdi: string,
  selectedTooth: string | null,
  teethStates: TeethStates
): DisplayState {
  const problem = teethStates[fdi]?.problem?.trim();
  if (problem?.toLowerCase() === "missing") return "missing";
  if (selectedTooth === fdi) return "checked";
  if (problem) return "diagnosed";
  return "default";
}

function imageVariant(state: DisplayState): ToothImageVariant {
  if (state === "checked" || state === "diagnosed") return "checked";
  if (state === "missing") return "missing";
  return "default";
}

function DashedVertical({ height }: { height: number }) {
  const dash = 4;
  const gap = 3;
  const count = Math.ceil(height / (dash + gap));
  return (
    <View style={{ width: 1.5, height }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: 1.5,
            height: dash,
            marginBottom: gap,
            backgroundColor: "#fd006a",
          }}
        />
      ))}
    </View>
  );
}

/**
 * FDI odontogram matching Practice web chart:
 * permanent outer + primary inner, pink crosshair, assets/teeth PNGs.
 */
export function TeethChart({
  teethStates,
  selectedTooth,
  onToothPress,
  maxWidth,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const size = Math.min(maxWidth ?? 560, Math.max(280, screenW - 48));

  return (
    <View
      className="self-center overflow-hidden rounded-xl border border-neutral-200 bg-white"
      style={{ width: size, height: size, position: "relative" }}
      accessibilityLabel="FDI dental chart"
    >
      {/* Crosshair */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          width: size,
          top: size / 2 - 1,
          height: 2,
          backgroundColor: "#fd006a",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: size / 2 - 0.75,
          top: 0,
          width: 1.5,
          height: size,
        }}
      >
        <DashedVertical height={size} />
      </View>

      {ALL_CHART_TEETH.map((t) => {
        const state = displayState(t.fdi, selectedTooth, teethStates);
        const primary = isDeciduousFdi(t.fdi);
        const scale = primary ? TOOTH_SCALE_PRIMARY : TOOTH_SCALE_PERM;
        const toothPx = (scale / 100) * size;
        const hit = Math.max(toothPx, 44);
        const cx = (t.x / 100) * size;
        const cy = (t.y / 100) * size;
        const lx = (t.lx / 100) * size;
        const ly = (t.ly / 100) * size;
        const variant = imageVariant(state);
        const src = getToothImageSource(t.fdi, variant);
        const opacity = state === "missing" ? 0.35 : 1;

        // Fragment keeps absolute coords relative to the chart (not a 0-size wrapper).
        return (
          <Fragment key={t.fdi}>
            <Pressable
              onPress={() => onToothPress(t.fdi)}
              accessibilityRole="button"
              accessibilityLabel={`Tooth ${t.fdi}`}
              hitSlop={2}
              style={{
                position: "absolute",
                left: cx - hit / 2,
                top: cy - hit / 2,
                width: hit,
                height: hit,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
              }}
            >
              {src ? (
                <Image
                  source={src}
                  style={{ width: toothPx, height: toothPx, opacity }}
                  contentFit="contain"
                />
              ) : (
                <View
                  style={{
                    width: toothPx * 0.7,
                    height: toothPx * 0.7,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: "#1a1a1a",
                    backgroundColor:
                      state === "checked" || state === "diagnosed"
                        ? "rgba(212,160,23,0.3)"
                        : "#fff",
                    opacity,
                  }}
                />
              )}
            </Pressable>
            <Text
              pointerEvents="none"
              style={{
                position: "absolute",
                left: lx - 12,
                top: ly - 7,
                width: 24,
                textAlign: "center",
                fontSize: primary ? 9 : 10,
                lineHeight: 12,
                color: "#6b7280",
                zIndex: 3,
              }}
            >
              {t.fdi}
            </Text>
          </Fragment>
        );
      })}
    </View>
  );
}
