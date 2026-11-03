import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

type ExpoPrintModule = {
  print: (options: { uri: string }) => Promise<void>;
};

type ExpoSharingModule = {
  shareAsync: (
    url: string,
    options?: {
      mimeType?: string;
      dialogTitle?: string;
      UTI?: string;
    }
  ) => Promise<void>;
};

const SHARE_OPTS = {
  mimeType: "application/pdf",
  dialogTitle: "Print PDF",
  UTI: "com.adobe.pdf",
} as const;

async function sharePdfForPrint(uri: string): Promise<void> {
  const ExpoSharing =
    requireOptionalNativeModule<ExpoSharingModule>("ExpoSharing");

  if (!ExpoSharing?.shareAsync) {
    throw new Error(
      "File sharing is unavailable. Rebuild the development client so expo-sharing is linked, then choose wePrint from the share sheet."
    );
  }

  await ExpoSharing.shareAsync(uri, { ...SHARE_OPTS });
}

/**
 * Print a local PDF.
 * - Android: share the PDF so apps like wePrint / Seznik can open and print it
 *   (Seznik does not register as an Android Print Service, so the system
 *   print dialog will never list that printer).
 * - iOS: use the native print dialog when ExpoPrint is linked; otherwise share.
 */
export async function printLocalPdf(uri: string): Promise<void> {
  if (Platform.OS === "android") {
    await sharePdfForPrint(uri);
    return;
  }

  const ExpoPrint =
    requireOptionalNativeModule<ExpoPrintModule>("ExpoPrint");

  if (ExpoPrint?.print) {
    await ExpoPrint.print({ uri });
    return;
  }

  await sharePdfForPrint(uri);
}
