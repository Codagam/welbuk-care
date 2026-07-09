/** Visual config for appointment statuses (chip colors + short labels). */
export interface StatusStyle {
  label: string;
  chip: string; // background
  text: string; // foreground
}

const DEFAULT: StatusStyle = {
  label: "Scheduled",
  chip: "bg-neutral-100",
  text: "text-neutral-600",
};

const MAP: Record<string, StatusStyle> = {
  IN_PROGRESS: { label: "In progress", chip: "bg-brand-50", text: "text-brand-700" },
  WAITING: { label: "Waiting", chip: "bg-amber-50", text: "text-amber-700" },
  CONFIRMED: { label: "Confirmed", chip: "bg-blue-50", text: "text-blue-700" },
  SCHEDULED: { label: "Scheduled", chip: "bg-neutral-100", text: "text-neutral-600" },
  COMPLETED: { label: "Completed", chip: "bg-emerald-50", text: "text-emerald-700" },
  CANCELLED: { label: "Cancelled", chip: "bg-neutral-100", text: "text-neutral-400" },
  NO_SHOW: { label: "No show", chip: "bg-red-50", text: "text-red-600" },
  DROPS: { label: "Drops", chip: "bg-orange-50", text: "text-orange-700" },
  RESCHEDULE: { label: "Reschedule", chip: "bg-violet-50", text: "text-violet-700" },
  TENTATIVE: { label: "Tentative", chip: "bg-neutral-100", text: "text-neutral-500" },
  PENDING_PAYMENT: { label: "Pending pay", chip: "bg-yellow-50", text: "text-yellow-700" },
};

export function statusStyle(status?: string | null): StatusStyle {
  if (!status) return DEFAULT;
  return MAP[status.toUpperCase()] ?? { ...DEFAULT, label: status };
}

/** "10:30 AM" from an ISO time, or "" if missing/invalid. */
export function formatTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
