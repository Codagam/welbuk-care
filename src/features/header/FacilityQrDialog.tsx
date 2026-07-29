import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "@/lib/api/errors";
import { hasFacilityQrImage } from "@/lib/api/endpoints/facility-qr";
import { useActiveFacility, useAuthUser } from "@/lib/auth/store";
import { AppModal, Button } from "@/ui";

import {
  regenerateFacilityQr,
  resolveFacilityQr,
  type ResolvedFacilityQr,
} from "./facilityQrCache";

export function FacilityQrTriggerButton({
  onPress,
  light,
}: {
  onPress: () => void;
  /** Use on brand-colored headers (white icons). */
  light?: boolean;
}) {
  const color = light ? "#FFFFFF" : "#111827";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Facility QR code"
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
    >
      <Ionicons name="qr-code-outline" size={22} color={color} />
    </Pressable>
  );
}

export function FacilityQrDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const facility = useActiveFacility();
  const user = useAuthUser();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedFacilityQr | null>(null);

  const facilityId = facility?.id;
  const displayName =
    resolved?.share.name?.trim() || facility?.name || "Facility";

  const load = useCallback(async () => {
    if (!facilityId) {
      setError("Select a facility to show its QR code.");
      setResolved(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await resolveFacilityQr({
        user,
        facilityId,
        facilityName: facility?.name,
      });
      setResolved(next);
    } catch (e) {
      setResolved(null);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [facility?.name, facilityId, user]);

  useEffect(() => {
    if (!open) {
      setResolved(null);
      setError(null);
      setLoading(false);
      setGenerating(false);
      return;
    }
    void load();
  }, [open, load]);

  return (
    <AppModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/45 px-6"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          className="w-full max-w-md rounded-2xl bg-white p-5"
        >
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-lg font-semibold text-neutral-900">
                Facility QR code
              </Text>
              <Text className="text-sm text-neutral-500">
                {`Scan or share the booking link for ${displayName}.`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#FD006A" />
            </View>
          ) : error ? (
            <View className="gap-3 py-4">
              <Text className="text-center text-sm text-red-500">{error}</Text>
              <Button
                label="Try again"
                variant="outline"
                size="md"
                onPress={() => void load()}
              />
            </View>
          ) : resolved && hasFacilityQrImage(resolved.share) ? (
            <View className="items-center gap-3">
              <View className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <View className="rounded-xl bg-white p-3">
                  <Image
                    source={{ uri: resolved.localFileUri }}
                    style={{ width: 200, height: 200 }}
                    resizeMode="contain"
                    accessibilityLabel="Facility QR code"
                  />
                </View>
              </View>
              {resolved.fromCache ? (
                <Text className="text-center text-xs text-neutral-400">
                  Loaded from this device for your login
                </Text>
              ) : null}
              <Button
                label="Regenerate QR code"
                variant="outline"
                size="md"
                loading={generating}
                onPress={() => {
                  if (!facilityId) return;
                  setGenerating(true);
                  setError(null);
                  void regenerateFacilityQr({
                    user,
                    facilityId,
                    facilityName: facility?.name,
                  })
                    .then((next) => setResolved(next))
                    .catch((e) => setError(describeError(e)))
                    .finally(() => setGenerating(false));
                }}
              />
              <Text className="text-center text-[11px] text-neutral-400">
                Creates a new QR. Already-printed codes may stop working.
              </Text>
            </View>
          ) : (
            <View className="gap-3 py-4">
              <Text className="text-center text-sm text-neutral-500">
                No QR code is available for this facility yet.
              </Text>
              <Button
                label="Generate QR code"
                size="md"
                loading={generating}
                onPress={() => {
                  if (!facilityId) return;
                  setGenerating(true);
                  setError(null);
                  void resolveFacilityQr({
                    user,
                    facilityId,
                    facilityName: facility?.name,
                    forceRefresh: true,
                  })
                    .then((next) => setResolved(next))
                    .catch((e) => setError(describeError(e)))
                    .finally(() => setGenerating(false));
                }}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </AppModal>
  );
}
