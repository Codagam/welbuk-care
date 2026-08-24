import { Alert, Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { describeError } from "@/lib/api/errors";

function guessMime(uriOrName: string): string {
  const path = uriOrName.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".pdf")) return "application/pdf";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".doc")) return "application/msword";
  if (path.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function safeFileName(name: string | undefined, fallbackUri: string): string {
  const fromOpt = name?.trim();
  if (fromOpt) return fromOpt.replace(/[^\w.\-()+ ]+/g, "_");
  const fromUrl = fallbackUri.split("/").pop()?.split("?")[0];
  return fromUrl?.replace(/[^\w.\-()+ ]+/g, "_") || "download.bin";
}

/**
 * Save/share a local cache file without expo-sharing (works in Expo Go).
 * - Android: Storage Access Framework → user picks a folder
 * - iOS: system share sheet (Save to Files / share)
 */
export async function shareLocalFile(
  localUri: string,
  opts?: { fileName?: string; dialogTitle?: string }
): Promise<void> {
  const fileName = safeFileName(opts?.fileName, localUri);
  const mime = guessMime(fileName);

  if (Platform.OS === "android") {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error("Folder permission is required to download");
    }
    const dest = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName,
      mime
    );
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    Alert.alert("Downloaded", `Saved ${fileName}`);
    return;
  }

  // iOS — Share sheet (Save to Files, AirDrop, etc.)
  let uri = localUri;
  if (FileSystem.cacheDirectory) {
    const dest = `${FileSystem.cacheDirectory}${fileName}`;
    try {
      await FileSystem.copyAsync({ from: localUri, to: dest });
      uri = dest;
    } catch {
      /* use original */
    }
  }

  await Share.share({
    url: uri,
    title: opts?.dialogTitle ?? "Download",
  });
}

export async function shareLocalFileOrAlert(
  localUri: string,
  opts?: { fileName?: string; dialogTitle?: string }
): Promise<void> {
  try {
    await shareLocalFile(localUri, opts);
  } catch (e) {
    Alert.alert("Download failed", describeError(e));
  }
}
