import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/ui";
import { api } from "@/lib/api/client";
import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";

import { BRAND, Dialog, EmptyNote, showToast } from "../components/kit";

type IssueStatus = "ACTIVE" | "SUPERSEDED" | "CANCELLED" | "ENTERED_IN_ERROR";
type VoidCategory = "CLINICAL_CHANGE" | "DATA_ERROR";

type Issue = {
  id: string;
  consultationId: string;
  issueNumber: string | null;
  issuedAt: string;
  status: IssueStatus;
  voidCategory: VoidCategory | null;
  voidReason: string | null;
  voidedAt: string | null;
  supersedesId: string | null;
  supersededById: string | null;
  doctorName: string | null;
  lineCount: number;
};

/** Status by LABEL, not by colour alone. */
const STATUS_LABEL: Record<
  IssueStatus,
  { label: string; box: string; text: string }
> = {
  ACTIVE: { label: "Current", box: "bg-brand", text: "text-white" },
  SUPERSEDED: { label: "Replaced", box: "bg-neutral-200", text: "text-neutral-700" },
  CANCELLED: {
    label: "Withdrawn",
    box: "border border-neutral-300 bg-white",
    text: "text-neutral-700",
  },
  ENTERED_IN_ERROR: {
    label: "Recorded in error",
    box: "bg-red-100",
    text: "text-red-700",
  },
};

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function doctorLabel(name: string): string {
  return /^dr\.?\s/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`;
}

/**
 * "Prescriptions issued" — Care port of Practice
 * `components/prescription/prescription-history-card.tsx`
 * (`GET /api/prescription-issues`, `POST /api/prescription-issues/[id]/void`).
 * Withdrawn ones stay listed: the record of what was issued never disappears.
 */
export function PrescriptionHistoryCard({
  patientId,
  facilityId,
  canWithdraw = false,
}: {
  patientId: string;
  facilityId: string;
  canWithdraw?: boolean;
}) {
  const qc = useQueryClient();
  const key = ["prescription-issues", patientId, facilityId];
  const [voidTarget, setVoidTarget] = useState<Issue | null>(null);

  const q = useQuery({
    queryKey: key,
    enabled: !!patientId && !!facilityId,
    queryFn: () =>
      api<{ issues: Issue[]; totalCount: number }>({
        path: "/api/prescription-issues",
        query: { patientId, facilityId },
      }),
  });

  const voidIssue = useMutation({
    mutationFn: (args: { id: string; category: VoidCategory; reason: string }) =>
      api({
        path: `/api/prescription-issues/${encodeURIComponent(args.id)}/void`,
        method: "POST",
        body: { facilityId, category: args.category, reason: args.reason },
      }),
    onSuccess: async () => {
      showToast("Prescription withdrawn");
      setVoidTarget(null);
      await qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => showToast(describeError(e), "error"),
  });

  const issues = q.data?.issues ?? [];

  return (
    <SectionChrome
      title="Prescriptions issued"
      icon="document-text-outline"
      badge={issues.length}
      collapsible
      defaultOpen={false}
    >
      <Text className="mb-3 text-xs text-neutral-500">
        Every prescription handed to this patient. Withdrawn ones stay listed —
        the record of what was issued does not disappear.
      </Text>
      {q.isLoading ? (
        <View className="items-center py-6">
          <ActivityIndicator color={BRAND} />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : issues.length === 0 ? (
        <EmptyNote
          icon="document-text-outline"
          title="No prescriptions issued yet"
          description="Prescriptions appear here once a consult is completed."
        />
      ) : (
        <View>
          {issues.map((issue, i) => {
            const voided =
              issue.status === "CANCELLED" ||
              issue.status === "ENTERED_IN_ERROR";
            const status = STATUS_LABEL[issue.status];
            return (
              <View
                key={issue.id}
                className={`flex-row flex-wrap items-start gap-3 py-3 ${
                  i < issues.length - 1 ? "border-b border-neutral-100" : ""
                }`}
              >
                <View className="min-w-0 flex-1">
                  <Text
                    className={`text-sm font-medium ${
                      voided
                        ? "text-neutral-400 line-through"
                        : "text-neutral-900"
                    }`}
                  >
                    {issue.issueNumber ?? "Prescription"}
                    <Text className="font-normal text-neutral-500">
                      {"  "}
                      {issue.lineCount} item{issue.lineCount === 1 ? "" : "s"}
                    </Text>
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {formatDateTime(issue.issuedAt)}
                    {issue.doctorName ? ` · ${doctorLabel(issue.doctorName)}` : ""}
                  </Text>
                  {issue.supersededById ? (
                    <Text className="text-xs text-neutral-500">
                      → replaced by a later prescription
                    </Text>
                  ) : null}
                  {issue.supersedesId ? (
                    <Text className="text-xs text-neutral-500">
                      ↳ replaces an earlier prescription
                    </Text>
                  ) : null}
                  {voided && issue.voidReason ? (
                    <Text className="mt-1 text-xs text-neutral-500">
                      <Text className="font-medium">Reason:</Text>{" "}
                      {issue.voidReason}
                    </Text>
                  ) : null}
                </View>
                <View className={`rounded-md px-2 py-0.5 ${status.box}`}>
                  <Text className={`text-xs font-semibold ${status.text}`}>
                    {status.label}
                  </Text>
                </View>
                {canWithdraw && issue.status === "ACTIVE" ? (
                  <Pressable
                    onPress={() => setVoidTarget(issue)}
                    className="min-h-[32px] flex-row items-center gap-1 rounded-lg px-2 active:bg-neutral-100"
                  >
                    <Ionicons name="ban-outline" size={14} color="#374151" />
                    <Text className="text-sm font-medium text-neutral-800">
                      Withdraw
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {voidTarget ? (
        <WithdrawDialog
          pending={voidIssue.isPending}
          onClose={() => setVoidTarget(null)}
          onConfirm={(category, reason) =>
            voidIssue.mutate({ id: voidTarget.id, category, reason })
          }
        />
      ) : null}
    </SectionChrome>
  );
}

/**
 * Asked as a CLINICAL question, each option stating its consequence: the
 * wrong answer erases an adverse-reaction signal for the next prescriber.
 */
function WithdrawDialog({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: (category: VoidCategory, reason: string) => void;
}) {
  const [category, setCategory] = useState<VoidCategory | "">("");
  const [reason, setReason] = useState("");
  const tooShort = wordCount(reason) < 3;

  const option = (value: VoidCategory, title: string, body: string) => {
    const selected = category === value;
    return (
      <Pressable
        onPress={() => setCategory(value)}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        className={`flex-row gap-3 rounded-xl border p-3 ${
          selected ? "border-brand bg-brand/5" : "border-neutral-200"
        }`}
      >
        <Ionicons
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={20}
          color={selected ? BRAND : "#9ca3af"}
        />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-neutral-900">{title}</Text>
          <Text className="text-sm text-neutral-500">{body}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Withdraw this prescription?"
      description="It stays in the patient's record either way — prescriptions are never deleted. Issue a replacement afterwards if one is needed."
      footer={
        <>
          <Button
            label="Cancel"
            variant="outline"
            size="md"
            onPress={onClose}
            disabled={pending}
          />
          <Button
            label="Withdraw prescription"
            variant="danger"
            size="md"
            loading={pending}
            disabled={!category || tooShort}
            onPress={() => category && onConfirm(category, reason.trim())}
          />
        </>
      }
    >
      <View className="gap-3">
        <Text className="text-sm font-medium text-neutral-700">
          Why are you withdrawing it?
        </Text>
        {option(
          "CLINICAL_CHANGE",
          "The plan changed",
          "Drug stopped, dose changed, or the patient reacted badly. Stays in their history as a real prescription."
        )}
        {option(
          "DATA_ERROR",
          "It was recorded in error",
          "Wrong patient or a duplicate entry. Marked as an error and removed from the clinical view."
        )}
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-neutral-700">Reason</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          placeholder="e.g. Patient reported a rash, amoxicillin stopped"
          placeholderTextColor="#9ca3af"
          style={{ minHeight: 64, textAlignVertical: "top" }}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900"
        />
        {reason.length > 0 && tooShort ? (
          <Text className="text-xs text-red-500">Add a few more words.</Text>
        ) : null}
      </View>
    </Dialog>
  );
}
