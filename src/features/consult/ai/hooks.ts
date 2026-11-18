import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useFacilityEntitlements } from "@/features/permissions";
import {
  getAiConfig,
  getAiConsent,
  getConversationHistory,
  getConversationMessages,
  recordAiConsent,
  type AiConsentState,
  type RecordAiConsentInput,
} from "@/lib/api/endpoints/speakadoc";

/** Subscription feature that carries Live Conversation (Practice `consult.ai-consultation`). */
export const AI_CONSULT_FEATURE = "consult.ai-consultation";

/**
 * When the Live Conversation (and its mic) shows — the same three layers as
 * Practice, all ANDed, OFF by default:
 *   1. site     → SiteConfig `ai_enable`
 *   2. facility → `Facility.aiEnable`
 *   3. plan     → the `consult.ai-consultation` entitlement
 * (1)+(2) come from GET /api/config/ai; (3) from the facility entitlements.
 * Loading or an error reads as OFF. The server re-checks all three before it
 * mints a SpeakADoc session or saves a result, so this only decides what is
 * shown, never what is allowed.
 */
export function useAiFeatureGate(facilityId: string | null | undefined) {
  const configQ = useQuery({
    queryKey: ["ai-config", facilityId ?? ""],
    enabled: Boolean(facilityId?.trim()),
    staleTime: 60_000,
    queryFn: () => getAiConfig(facilityId!),
  });
  const { hasFeature } = useFacilityEntitlements(facilityId);
  return configQ.data?.enabled === true && hasFeature(AI_CONSULT_FEATURE);
}

export function aiConsentQueryKey(consultationId: string) {
  return ["ai-capture-consent", consultationId] as const;
}

/**
 * Prefetched while the panel shows, not on press: the first tap on the mic
 * either records or asks, never waits with a patient in the room. The server
 * refuses unconsented capture regardless; this only decides whether the ask opens.
 */
export function useAiCaptureConsent(consultationId: string, enabled: boolean) {
  return useQuery<AiConsentState>({
    queryKey: aiConsentQueryKey(consultationId),
    enabled: Boolean(consultationId) && enabled,
    staleTime: 30_000,
    queryFn: () => getAiConsent(consultationId),
  });
}

export function useRecordAiConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordAiConsentInput) => recordAiConsent(input),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: aiConsentQueryKey(vars.consultationId) }),
  });
}

/** This patient's earlier recorded conversations (Session History). */
export function useConversationHistory(consultationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["conversation-history", consultationId],
    enabled: Boolean(consultationId) && enabled,
    queryFn: () => getConversationHistory(consultationId),
  });
}

/** A previous consultation's messages, shown read-only once ticked. */
export function usePreviousConversation(consultationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["conversation", consultationId],
    enabled: Boolean(consultationId) && enabled,
    queryFn: () => getConversationMessages(consultationId),
  });
}
