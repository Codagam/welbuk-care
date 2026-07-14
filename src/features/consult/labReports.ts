import type { LabReportItem, LabReportPayload } from "./types";

export function labReportHasViewableFiles(
  reportPayload?: LabReportPayload | null
): boolean {
  if (!reportPayload) return false;
  if (reportPayload.reportImageUrls?.length) return true;
  if (reportPayload.labReportAttachmentUrls?.length) return true;
  if (reportPayload.radiologyReport?.trim()) return true;
  if (reportPayload.reportNote?.trim()) return true;
  if (
    reportPayload.results &&
    typeof reportPayload.results === "object" &&
    Object.keys(reportPayload.results as object).length > 0
  ) {
    return true;
  }
  return false;
}

export function labReportSourceLabel(
  source?: "upload" | "referral" | "visit"
): string {
  if (source === "referral") return "Lab referral";
  if (source === "visit") return "Visit document";
  return "Uploaded";
}

export function labReportFileUrls(payload?: LabReportPayload | null): string[] {
  if (!payload) return [];
  return [
    ...(payload.reportImageUrls ?? []),
    ...(payload.labReportAttachmentUrls ?? []),
  ].filter(Boolean);
}

function normalizeReportFileUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).pathname;
    }
  } catch {
    /* use path fallback */
  }
  return trimmed.split("?")[0] ?? trimmed;
}

export function labReportForFileUrl(
  url: string,
  reports: LabReportItem[]
): LabReportItem | undefined {
  const needle = normalizeReportFileUrl(url);
  if (!needle) return undefined;
  return reports.find((r) => {
    const attachments = r.reportPayload?.labReportAttachmentUrls ?? [];
    const images = r.reportPayload?.reportImageUrls ?? [];
    if (
      [...attachments, ...images].some(
        (u) => normalizeReportFileUrl(u) === needle
      )
    ) {
      return true;
    }
    return normalizeReportFileUrl(r.result ?? "") === needle;
  });
}

export function isReportAttachmentPdf(url: string): boolean {
  return /\.pdf($|\?)/i.test(url);
}

export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp|svg)($|\?)/i.test(url);
}
