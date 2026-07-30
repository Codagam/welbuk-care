import { Platform, Share } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as FileSystem from "expo-file-system/legacy";

type ExpoPrintModule = {
  print: (options: { uri: string }) => Promise<void>;
};

/**
 * Opens the native print dialog for a local PDF when ExpoPrint is linked.
 * Falls back to the system share sheet if the current development client
 * was built before expo-print was installed (rebuild required for native print).
 */
export async function printLocalPdf(uri: string): Promise<void> {
  const ExpoPrint =
    requireOptionalNativeModule<ExpoPrintModule>("ExpoPrint");

  if (ExpoPrint?.print) {
    await ExpoPrint.print({ uri });
    return;
  }

  // Dev client without ExpoPrint — share sheet (Print on iOS; PDF apps on Android).
  let shareUri = uri;
  if (Platform.OS === "android" && FileSystem.getContentUriAsync) {
    try {
      shareUri = await FileSystem.getContentUriAsync(uri);
    } catch {
      /* use file uri */
    }
  }

  await Share.share({
    url: shareUri,
    title: "Print PDF",
    ...(Platform.OS === "android"
      ? { message: "Open the PDF, then choose Print." }
      : {}),
  });
}
