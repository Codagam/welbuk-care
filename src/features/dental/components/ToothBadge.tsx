import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";

import { getToothImageSource } from "../toothAssets";

type Props = {
  /** FDI tooth id, e.g. "36" */
  toothNumber: string | number;
  size?: number;
  /**
   * When true, use the FDI PNG from `@/assets/teeth` if present.
   * Default false — outline icon matches Practice header badge.
   */
  preferAsset?: boolean;
};

/**
 * Practice-style tooth badge: light tooth outline with FDI number centered in brand pink.
 */
export function ToothBadge({
  toothNumber,
  size = 44,
  preferAsset = false,
}: Props) {
  const id = String(toothNumber).trim();
  const asset = preferAsset ? getToothImageSource(id, "default") : null;
  // Keep number smaller than icon so it has clear space inside the outline
  const fontSize = Math.max(10, Math.round(size * 0.28));

  return (
    <View
      accessible
      accessibilityLabel={`Tooth ${id}`}
      style={{ width: size, height: size }}
      className="relative shrink-0 items-center justify-center"
    >
      {asset ? (
        <Image
          source={asset}
          style={{ width: size, height: size, opacity: 0.85 }}
          resizeMode="contain"
        />
      ) : (
        <MaterialCommunityIcons
          name="tooth-outline"
          size={size}
          color="#6B6B6B"
        />
      )}
      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
        style={{
          paddingHorizontal: size * 0.22,
          paddingBottom: size * 0.16,
        }}
      >
        <Text
          className="text-center font-semibold tabular-nums text-brand"
          style={{ fontSize, lineHeight: fontSize + 2 }}
          numberOfLines={1}
        >
          {id}
        </Text>
      </View>
    </View>
  );
}
