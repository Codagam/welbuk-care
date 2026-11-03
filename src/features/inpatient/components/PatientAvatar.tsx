import { Text, View } from "react-native";

import { avatarBg, personInitials } from "../utils";

export function PatientAvatar({
  name,
  size = 36,
}: {
  name: string;
  size?: number;
}) {
  const bg = avatarBg(name);
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: `${bg}22`,
        borderWidth: 1.5,
        borderColor: `${bg}44`,
      }}
    >
      <Text
        style={{
          color: bg,
          fontSize: Math.round(size * 0.34),
          fontWeight: "700",
        }}
      >
        {personInitials(name)}
      </Text>
    </View>
  );
}
