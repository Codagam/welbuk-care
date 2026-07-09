import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";

/** A slim bar shown while the device is offline. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  if (!offline) return null;
  return (
    <View className="bg-neutral-800 px-4 py-1.5">
      <Text className="text-center text-xs font-medium text-white">
        You&apos;re offline — changes will retry when you reconnect.
      </Text>
    </View>
  );
}
