/** Status badge styles — exact Practice hex colours. */

export interface StatusStyle {
  label: string;
  backgroundColor: string;
  color: string;
  borderColor: string;
}

const DEFAULT: StatusStyle = {
  label: "Scheduled",
  backgroundColor: "#fff0f6",
  color: "#fd006a",
  borderColor: "#ffb3d1",
};

const MAP: Record<string, StatusStyle> = {
  IN_PROGRESS: {
    label: "In Progress",
    backgroundColor: "#ffbfdc",
    color: "#96003f",
    borderColor: "#ff87b8",
  },
  WAITING: {
    label: "Waiting",
    backgroundColor: "#fff0f6",
    color: "#fd006a",
    borderColor: "#ffb3d1",
  },
  CONFIRMED: {
    label: "Confirmed",
    backgroundColor: "#fff0f6",
    color: "#fd006a",
    borderColor: "#ffb3d1",
  },
  SCHEDULED: {
    label: "Scheduled",
    backgroundColor: "#fff0f6",
    color: "#fd006a",
    borderColor: "#ffb3d1",
  },
  COMPLETED: {
    label: "Completed",
    backgroundColor: "#ffd9e8",
    color: "#c20052",
    borderColor: "#ff9ec4",
  },
  CANCELLED: {
    label: "Cancelled",
    backgroundColor: "#ffd9e8",
    color: "#d10058",
    borderColor: "#ff9ec4",
  },
  NO_SHOW: {
    label: "No Show",
    backgroundColor: "#fff7e6",
    color: "#9a6400",
    borderColor: "#ffd27a",
  },
  DROPS: {
    label: "Drops",
    backgroundColor: "#ffbfdc",
    color: "#96003f",
    borderColor: "#ff87b8",
  },
  RESCHEDULE: {
    label: "Reschedule",
    backgroundColor: "#ffbfdc",
    color: "#96003f",
    borderColor: "#ff87b8",
  },
  TENTATIVE: {
    label: "Tentative",
    backgroundColor: "#fff0f6",
    color: "#fd006a",
    borderColor: "#ffb3d1",
  },
  PENDING_PAYMENT: {
    label: "Pending Payment",
    backgroundColor: "#fff0f6",
    color: "#fd006a",
    borderColor: "#ffb3d1",
  },
};

export function statusStyle(status?: string | null): StatusStyle {
  if (!status) return DEFAULT;
  const key = status.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return MAP[key] ?? { ...DEFAULT, label: status.replace(/_/g, " ") };
}
