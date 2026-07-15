/** Status chip styles (brand-pink family, matching Care + web primary badges). */

export interface StatusStyle {
  label: string;
  chip: string;
  text: string;
  border: string;
}

const DEFAULT: StatusStyle = {
  label: "Scheduled",
  chip: "bg-brand-50",
  text: "text-brand",
  border: "border-brand-200",
};

const MAP: Record<string, StatusStyle> = {
  IN_PROGRESS: {
    label: "In Progress",
    chip: "bg-brand-100",
    text: "text-brand-800",
    border: "border-brand-300",
  },
  WAITING: {
    label: "Waiting",
    chip: "bg-brand-50",
    text: "text-brand",
    border: "border-brand-200",
  },
  CONFIRMED: {
    label: "Confirmed",
    chip: "bg-brand-50",
    text: "text-brand",
    border: "border-brand-200",
  },
  SCHEDULED: {
    label: "Scheduled",
    chip: "bg-brand-50",
    text: "text-brand",
    border: "border-brand-200",
  },
  COMPLETED: {
    label: "Completed",
    chip: "bg-brand-100",
    text: "text-brand-700",
    border: "border-brand-300",
  },
  CANCELLED: {
    label: "Cancelled",
    chip: "bg-neutral-100",
    text: "text-neutral-400",
    border: "border-neutral-200",
  },
  NO_SHOW: {
    label: "No Show",
    chip: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
  },
  DROPS: {
    label: "Drops",
    chip: "bg-brand-100",
    text: "text-brand-800",
    border: "border-brand-300",
  },
  RESCHEDULE: {
    label: "Reschedule",
    chip: "bg-brand-100",
    text: "text-brand-800",
    border: "border-brand-300",
  },
  TENTATIVE: {
    label: "Tentative",
    chip: "bg-brand-50",
    text: "text-brand",
    border: "border-brand-200",
  },
  PENDING_PAYMENT: {
    label: "Pending Payment",
    chip: "bg-brand-50",
    text: "text-brand",
    border: "border-brand-200",
  },
};

export function statusStyle(status?: string | null): StatusStyle {
  if (!status) return DEFAULT;
  const key = status.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return MAP[key] ?? { ...DEFAULT, label: status };
}
