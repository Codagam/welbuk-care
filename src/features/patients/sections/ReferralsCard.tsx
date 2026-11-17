import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "@/lib/api/errors";
import type { ReferralRow } from "@/lib/api/endpoints/referral";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { useLabReportViewer } from "@/features/consult/components/LabReportViewer";
import { labReportHasViewableFiles } from "@/features/consult/labReports";
import { usePatientReferrals } from "../hooks";
import { BRAND, formatShortDate } from "../components/kit";

function formatStatus(status?: string): string {
  return String(status ?? "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Same three colour groups as Practice's ReferralsCard. */
function statusTone(status?: string): { box: string; text: string } {
  const s = String(status ?? "").toLowerCase();
  if (s === "completed" || s === "delivered" || s === "report_generated") {
    return { box: "border-green-200 bg-green-50", text: "text-green-800" };
  }
  if (s === "processing" || s === "in_progress") {
    return { box: "border-yellow-200 bg-yellow-50", text: "text-yellow-800" };
  }
  if (s === "pending" || s === "registered" || s === "referral_received") {
    return { box: "border-slate-200 bg-slate-50", text: "text-slate-800" };
  }
  return { box: "border-neutral-200 bg-neutral-50", text: "text-neutral-600" };
}

function testsText(tests: ReferralRow["tests"]): string | null {
  if (Array.isArray(tests)) return tests.filter(Boolean).join(", ") || null;
  return typeof tests === "string" && tests.trim() ? tests.trim() : null;
}

export function ReferralsCard({
  mongoPatientId,
  patientName,
}: {
  mongoPatientId: string;
  patientName?: string;
}) {
  const q = usePatientReferrals(mongoPatientId);
  const rows = q.data ?? [];
  const viewer = useLabReportViewer(patientName);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openReport = async (row: ReferralRow, key: string) => {
    if (!row.reportPayload) return;
    setOpeningId(key);
    try {
      await viewer.openReport({
        id: row.id,
        test: row.referralType ? `${row.referralType} report` : "Lab report",
        reportPayload: {
          ...row.reportPayload,
          reportGeneratedAt:
            row.reportGeneratedAt ?? row.reportPayload.reportGeneratedAt,
        },
      });
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <SectionChrome
      title="Referrals"
      icon="git-compare-outline"
      badge={rows.length}
      collapsible
      defaultOpen={false}
    >
      {q.isLoading && !q.data ? (
        <View className="items-center py-4">
          <ActivityIndicator color={BRAND} />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : rows.length === 0 ? (
        <Text className="text-xs italic text-neutral-500">
          No referrals for this patient.
        </Text>
      ) : (
        <View className="gap-0">
          {rows.map((row, idx) => {
            const key = row.id ?? `row-${idx}`;
            const tone = statusTone(row.status);
            const tests = testsText(row.tests);
            const facility = row.toFacilityName || row.fromFacilityName;
            const hasReport =
              row.reportPayload != null &&
              labReportHasViewableFiles(row.reportPayload);
            return (
              <View
                key={key}
                className={`flex-row items-start gap-3 py-2.5 ${
                  idx < rows.length - 1 ? "border-b border-neutral-100" : ""
                }`}
              >
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Text className="text-xs font-medium text-neutral-900">
                      {row.referralType || "Referral"}
                    </Text>
                    <View className="rounded-full border border-neutral-200 px-2 py-0.5">
                      <Text className="text-[10px] text-neutral-600">
                        {row.direction === "incoming" ? "Incoming" : "Outgoing"}
                      </Text>
                    </View>
                    <View className={`rounded-full border px-2 py-0.5 ${tone.box}`}>
                      <Text className={`text-[10px] font-medium ${tone.text}`}>
                        {formatStatus(row.status)}
                      </Text>
                    </View>
                  </View>
                  {tests ? (
                    <Text className="text-xs text-neutral-700" numberOfLines={3}>
                      {tests}
                    </Text>
                  ) : null}
                  <Text className="text-[10px] text-neutral-500">
                    {[
                      formatShortDate(row.createdAt),
                      row.priority ? `Priority: ${row.priority}` : null,
                      facility,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                {hasReport ? (
                  <Pressable
                    onPress={() => void openReport(row, key)}
                    disabled={openingId === key}
                    accessibilityLabel="View report"
                    className="h-8 flex-row items-center gap-1 rounded-lg border border-neutral-300 px-2.5"
                  >
                    {openingId === key ? (
                      <ActivityIndicator size="small" color={BRAND} />
                    ) : (
                      <>
                        <Ionicons name="open-outline" size={14} color={BRAND} />
                        <Text className="text-xs font-medium text-brand">
                          View report
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      {viewer.error ? (
        <Text className="mt-2 text-sm text-red-500">{viewer.error}</Text>
      ) : null}
      {viewer.modal}
    </SectionChrome>
  );
}
