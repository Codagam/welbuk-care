/**
 * AI (SpeakADoc / Care Scribe) endpoints on the Practice API.
 *
 * Mirrors Practice's consult screen: the AI gate, the recording consent, the
 * SpeakADoc session token and result, and the Live Conversation edits /
 * Summarise / Session History. Contract: Practice
 * `docs/SPEAKADOC_LIVE_CONVERSATION_FLOW.md`. Care calls exactly the routes the
 * web consult calls, with the staff Bearer token.
 */
import { api } from "@/lib/api/client";
import type { ConversationMessage } from "@/features/consult/types";

// ---- AI gate (site + facility half) ---------------------------------------

export interface AiConfig {
  siteEnabled: boolean;
  facilityEnabled: boolean;
  /** siteEnabled && facilityEnabled. The subscription entitlement is ANDed on top. */
  enabled: boolean;
}

/** GET /api/config/ai?facilityId= */
export function getAiConfig(facilityId: string): Promise<AiConfig> {
  return api({ path: "/api/config/ai", query: { facilityId } });
}

// ---- AI capture consent ---------------------------------------------------

export interface AiConsentPurposeState {
  purpose: string;
  label: string;
  /** The sentence to read aloud. Served by the API so there is one copy of it. */
  script: string;
  decision: "GRANTED" | "WITHDRAWN" | null;
  decidedAt: string | null;
  source: string | null;
}

export interface AiConsentState {
  patient: AiConsentPurposeState[];
  clinician: { consentedAt: string | null; script: string };
  /** Nothing left to ask: start recording immediately. */
  ready: boolean;
  missingPurposes: string[];
}

/** GET /api/consult/ai-consent?consultationId= */
export function getAiConsent(consultationId: string): Promise<AiConsentState> {
  return api({ path: "/api/consult/ai-consent", query: { consultationId } });
}

export interface RecordAiConsentInput {
  consultationId: string;
  grants: { purpose: string; decision: "GRANTED" | "WITHDRAWN" }[];
  clinicianAgreed?: boolean;
  note?: string;
}

/** POST /api/consult/ai-consent */
export function recordAiConsent(
  body: RecordAiConsentInput
): Promise<{ ready: boolean; missingPurposes: string[] }> {
  return api({ path: "/api/consult/ai-consent", method: "POST", body });
}

// ---- SpeakADoc session + result -------------------------------------------

export interface SpeakadocSession {
  token: string;
  expiresAt: string;
  /** `{SPEAKADOC_WIDGET_ORIGIN}/?embed=1&token=…&parentOrigin=…&autostart=1&compact=1` */
  widgetUrl: string;
  usageSessionId: string | null;
}

/**
 * POST /api/speakadoc/session-token. The facility is taken from the
 * consultation on the server. No `Origin` header is sent from the app, so the
 * server uses its own origin as `parentOrigin` (already on SpeakADoc's list).
 */
export function mintSpeakadocSession(body: {
  facilityId: string;
  consultationId: string;
  patientId?: string;
}): Promise<SpeakadocSession> {
  return api({ path: "/api/speakadoc/session-token", method: "POST", body });
}

export interface SaveSpeakadocResultResponse {
  success: boolean;
  messagesReplaced?: number;
  summaryUpdated?: boolean;
  labsAdded?: number;
}

/** POST /api/speakadoc/result. 409 CONSULT_COMPLETED on a locked consult. */
export function saveSpeakadocResult(body: {
  consultationId: string;
  result: unknown;
  usageSessionId: string | null;
}): Promise<SaveSpeakadocResultResponse> {
  return api({ path: "/api/speakadoc/result", method: "POST", body });
}

// ---- Live Conversation edits ----------------------------------------------

/** PATCH /api/consult/conversation: re-word a message or swap doctor/patient. */
export function patchConversationMessage(body: {
  messageId: string;
  text?: string;
  speaker?: "doctor" | "patient";
}): Promise<unknown> {
  return api({ path: "/api/consult/conversation", method: "PATCH", body });
}

/** DELETE /api/consult/conversation?messageId= (soft delete). */
export function deleteConversationMessage(messageId: string): Promise<unknown> {
  return api({
    path: "/api/consult/conversation",
    method: "DELETE",
    query: { messageId },
  });
}

// ---- Session History + Summarise ------------------------------------------

/** One earlier recorded conversation of this patient. */
export interface ConversationHistoryItem {
  consultationId: string;
  /** Previous Conversation <number>, counted from the oldest. */
  number: number;
  recordedAt: string;
  /** Date and time, e.g. "12 Nov 2026, 10:30 am". */
  label: string;
  messageCount: number;
  doctorName: string | null;
  /** Promoted into this consultation (part of its notes). */
  promoted: boolean;
}

/** GET /api/consult/conversation/history?consultationId= */
export async function getConversationHistory(
  consultationId: string
): Promise<ConversationHistoryItem[]> {
  const res = await api<{ conversations?: ConversationHistoryItem[] }>({
    path: "/api/consult/conversation/history",
    query: { consultationId },
  });
  return res.conversations ?? [];
}

/** Messages of any consultation (used for read-only previous conversations). */
export async function getConversationMessages(
  consultationId: string
): Promise<ConversationMessage[]> {
  const res = await api<{ messages?: ConversationMessage[] }>({
    path: "/api/consult/conversation",
    query: { consultationId },
  });
  return res.messages ?? [];
}

/**
 * Notes the server generated and saved from this conversation plus the
 * promoted previous ones. They REPLACE the summary, SOAP and Detected Symptoms.
 */
export interface GeneratedNotes {
  summary: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  symptoms: { name: string; since: string }[];
  promotedConsultationIds: string[];
}

/** POST /api/consult/conversation/summary (Summarise / Promote / remove). */
export function generateConversationNotes(body: {
  consultationId: string;
  promotedConsultationIds?: string[];
}): Promise<GeneratedNotes> {
  return api({
    path: "/api/consult/conversation/summary",
    method: "POST",
    body,
  });
}
