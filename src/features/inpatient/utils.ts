import type {
  BillItem,
  BillTotals,
  InpatientAdmission,
  InpatientListRow,
  RateCardItem,
} from "./types";

export function formatInr(n: number | string | undefined | null): string {
  return (
    "₹" +
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Calendar `YYYY-MM-DD` (or ISO prefix) → `dd-mm-yyyy`. */
export function toDisplayDateDdMmYyyy(value: string): string {
  const raw = value.trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatPersonNameTitleCase(
  raw: string | null | undefined
): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      return w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function ipDaysBetween(
  admitDate: string | Date,
  dischargeDate: string | Date | null | undefined
): number {
  const end = dischargeDate ? new Date(dischargeDate) : new Date();
  return Math.max(
    1,
    Math.ceil((end.getTime() - new Date(admitDate).getTime()) / 86400000)
  );
}

export function personInitials(name?: string): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function inpatientRouteSegment(
  row: Pick<InpatientListRow, "id" | "ipSerial"> | Pick<InpatientAdmission, "id" | "ipSerial">
): string {
  return row.ipSerial != null ? String(row.ipSerial) : row.id;
}

export function ratePerDayFromRoom(
  room: InpatientAdmission["room"] | null | undefined
): number {
  if (!room) return 0;
  if (typeof room.ratePerDay === "number" && Number.isFinite(room.ratePerDay) && room.ratePerDay >= 0) {
    return room.ratePerDay;
  }
  const linked = room.rateCardItem?.rate;
  if (typeof linked === "number" && Number.isFinite(linked) && linked >= 0) {
    return linked;
  }
  return 0;
}

export const CAT_COLOR: Record<string, string> = {
  cat_con: "#2563EB",
  cat_lab: "#7C3AED",
  cat_rad: "#0891B2",
  cat_pha: "#059669",
  cat_roo: "#D97706",
  cat_pro: "#DC2626",
  cat_nur: "#DB2777",
  cat_ot: "#0891B2",
  cat_misc: "#6B7280",
  ROOM_TYPES: "#D97706",
  __uncategorized__: "#6B7280",
};

const BILL_LINE_CATEGORY_LABEL: Record<string, string> = {
  cat_roo: "Room rent",
  cat_nur: "Nursing",
  cat_con: "Consultation",
  cat_lab: "Laboratory",
  cat_rad: "Radiology",
  cat_pha: "Pharmacy",
  cat_pro: "Procedure",
  cat_ot: "OT",
  cat_misc: "Misc",
  __uncategorized__: "Uncategorized",
  ROOM_TYPES: "Room types",
};

export function billLineCategoryLabel(catId: string): string {
  return BILL_LINE_CATEGORY_LABEL[catId] ?? (catId?.trim() || "—");
}

export function newBillItemId(): string {
  return `bi_${Math.random().toString(36).slice(2, 9)}`;
}

export function recomputeLine(item: BillItem): BillItem {
  const qty = Number(item.qty) || 0;
  const rate = Number(item.rate) || 0;
  const discountPct = Number(item.discountPct) || 0;
  const taxRate = Number(item.taxRate) || 0;
  const base = qty * rate;
  const disc = (base * discountPct) / 100;
  const lineTotal = base - disc;
  const taxAmt = (lineTotal * taxRate) / 100;
  return { ...item, qty, rate, discountPct, taxRate, lineTotal, taxAmt };
}

/** Mirrors Practice `BILLING.calcBillTotals` without insurance. */
export function calcBillTotals(
  items: BillItem[],
  overallDiscountPct = 0
): BillTotals {
  const subtotal = items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
  const totalTax = items.reduce((s, it) => s + (Number(it.taxAmt) || 0), 0);
  const overallDisc = subtotal * ((Number(overallDiscountPct) || 0) / 100);
  const grossTotal = subtotal - overallDisc + totalTax;
  return {
    subtotal,
    overallDisc,
    totalTax,
    grossTotal,
    insuranceClaim: 0,
    coPayAmt: 0,
    patientPayable: grossTotal,
  };
}

/** Draft bills may omit `rate` on room lines; align with admission room tariff. */
export function patchRoomRentLineRates(
  items: BillItem[],
  room: InpatientAdmission["room"] | null | undefined
): BillItem[] {
  const fallback = ratePerDayFromRoom(room);
  if (fallback <= 0) return items.map(recomputeLine);

  return items.map((it) => {
    if (it.catId !== "cat_roo") return recomputeLine(it);
    const rate =
      typeof it.rate === "number" && Number.isFinite(it.rate) && it.rate > 0
        ? it.rate
        : fallback;
    return recomputeLine({ ...it, rate });
  });
}

function mapRoomTypeSvcId(roomType: string): string {
  const t = roomType.toUpperCase();
  if (t.includes("ICU")) return "svc_405";
  if (t.includes("SEMI")) return "svc_402";
  if (t.includes("PRIVATE")) return "svc_403";
  return "svc_401";
}

/** Initial IP bill lines: room rent only. */
export function buildBaseItems(admission: InpatientAdmission): BillItem[] {
  const days = ipDaysBetween(admission.admitDate, admission.dischargeDate);
  if (days <= 0) return [];
  const rate = ratePerDayFromRoom(admission.room);
  const name = admission.room.displayName;
  const total = days * rate;
  return [
    recomputeLine({
      id: "bi_room",
      serviceId: mapRoomTypeSvcId(admission.room.roomType),
      catId: "cat_roo",
      name: `${name} — ${days} day${days !== 1 ? "s" : ""}`,
      qty: days,
      rate,
      discountPct: 0,
      taxRate: 0,
      lineTotal: total,
      taxAmt: 0,
    }),
  ];
}

export function billItemFromRateCard(row: RateCardItem): BillItem {
  const raw = typeof row.categoryId === "string" ? row.categoryId.trim() : "";
  return recomputeLine({
    id: newBillItemId(),
    serviceId: row.id,
    catId: raw || "__uncategorized__",
    name: row.name,
    qty: 1,
    rate: Number(row.rate) || 0,
    discountPct: 0,
    taxRate: 0,
    lineTotal: 0,
    taxAmt: 0,
  });
}

export function mapAdmissionToRow(a: InpatientAdmission): InpatientListRow {
  const patientName =
    [a.patient.firstName, a.patient.lastName].filter(Boolean).join(" ").trim() ||
    "—";
  const patientCode =
    a.patient.patientId != null ? String(a.patient.patientId) : "—";
  const days = ipDaysBetween(a.admitDate, a.dischargeDate);
  const roomRate = ratePerDayFromRoom(a.room);
  const doctorName = (a.doctor.name ?? "").trim();
  const doctorShort =
    doctorName
      .split(/\s+/)
      .slice(0, 3)
      .join(" ") || "—";

  return {
    id: a.id,
    ipSerial: a.ipSerial ?? null,
    patientName,
    patientCode,
    patientNumberId: a.patient.patientId ?? null,
    roomLabel: a.room.displayName,
    roomType: a.room.roomType,
    roomNumber: a.room.roomNumber?.trim() || "—",
    admitDateLabel: new Date(a.admitDate).toISOString().slice(0, 10),
    days,
    doctorShort,
    diagnosis: a.diagnosis,
    running: days * roomRate,
    statusKey: a.status === "DISCHARGED" ? "discharged" : "admitted",
  };
}

export function patientDisplayName(a: InpatientAdmission): string {
  return (
    [a.patient.firstName, a.patient.lastName].filter(Boolean).join(" ").trim() ||
    "—"
  );
}
