/**
 * Consult Orders & referrals — Practice's `/api/consult/orders` contract.
 *
 *   GET    /api/consult/orders?consultationId=        each tab's draft, unsent lines, sent, recent picks
 *   POST   /api/consult/orders                        add a line { consultationId, kind, testName?, treatmentTypeId? }
 *   PATCH  /api/consult/orders                        draft fields (destination / priority / note / doctor / ward / stay)
 *   DELETE /api/consult/orders?consultationId=&id=    remove an UNSENT line
 *   POST   /api/consult/orders/send                   { consultationId, kind } or { consultationId, all: true }
 *
 * Plus the two pickers the card needs:
 *   GET /api/facility/referral-providers/options?facilityId=&referralType=
 *   GET /api/referral/receiving-doctors?fromFacilityId=&toFacilityId=&pageSize=
 *
 * Every write is behind Practice's consult lock (409 CONSULT_COMPLETED).
 */
import { api } from "@/lib/api/client";
import type {
  OrderDraft,
  OrderKind,
} from "@/features/consult/orders/orders";

export type OrderLine = {
  id: string;
  testName: string;
  priority: string;
  instructions: string;
  treatmentTypeId: string | null;
  feeRupees: number | null;
};

export type SentReferral = {
  referralId: string;
  toFacilityName: string;
  toDoctorName: string | null;
  status: string;
  sentVia: string | null;
  sentAt: string;
  priority: string;
  lines: string[];
};

export type BilledLine = {
  id: string;
  testName: string;
  sentAt: string;
  billed: boolean;
};

export type OrderService = {
  treatmentTypeId: string;
  name: string;
  /** Null = the clinic has not priced it: orderable, never billed. */
  fee: number | null;
};

export type OrderTabView = {
  draft: OrderDraft;
  lines: OrderLine[];
  sent: SentReferral[];
  billed: BilledLine[];
};

export type OrdersView = {
  locked: boolean;
  tabs: Record<OrderKind, OrderTabView>;
  recent: Record<OrderKind, string[]>;
  services: Record<OrderKind, OrderService[]>;
};

export type OrderDestination = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  label: string;
  source: "internal" | "listed" | "recent";
  partner: boolean;
};

export type ReceivingDoctor = {
  id: string;
  name: string;
  specialization: string | null;
};

export type OrderSendResult = {
  kind: OrderKind;
  referralId: string | null;
  count: number;
  billed: number;
  unpriced: number;
};

export function getConsultOrders(consultationId: string): Promise<OrdersView> {
  return api<OrdersView>({
    path: "/api/consult/orders",
    query: { consultationId },
  });
}

export function addConsultOrderLine(body: {
  consultationId: string;
  kind: OrderKind;
  testName?: string;
  treatmentTypeId?: string;
}): Promise<unknown> {
  return api({ path: "/api/consult/orders", method: "POST", body });
}

export function patchConsultOrderDraft(
  body: { consultationId: string; kind: OrderKind } & Partial<OrderDraft>
): Promise<{ draft: OrderDraft }> {
  return api<{ draft: OrderDraft }>({
    path: "/api/consult/orders",
    method: "PATCH",
    body,
  });
}

export function removeConsultOrderLine(
  consultationId: string,
  id: string
): Promise<unknown> {
  return api({
    path: "/api/consult/orders",
    method: "DELETE",
    query: { consultationId, id },
  });
}

/** Send one tab (the doctor pressed Send). */
export function sendConsultOrderTab(
  consultationId: string,
  kind: OrderKind
): Promise<{ sent: OrderSendResult[] }> {
  return api<{ sent: OrderSendResult[] }>({
    path: "/api/consult/orders/send",
    method: "POST",
    body: { consultationId, kind },
  });
}

/**
 * Send every tab holding unsent lines and a destination — what Complete does
 * before it locks the consult. Practice stops at the first failing tab and
 * names it; tabs left on "Print only" are never sent.
 */
export function sendAllConsultOrders(
  consultationId: string
): Promise<{ sent: OrderSendResult[] }> {
  return api<{ sent: OrderSendResult[] }>({
    path: "/api/consult/orders/send",
    method: "POST",
    body: { consultationId, all: true },
  });
}

export async function listOrderDestinations(
  facilityId: string,
  referralType: string
): Promise<OrderDestination[]> {
  const res = await api<{ options?: OrderDestination[] }>({
    path: "/api/facility/referral-providers/options",
    query: { facilityId, referralType },
  });
  return res.options ?? [];
}

export async function listReceivingDoctors(
  fromFacilityId: string,
  toFacilityId: string
): Promise<ReceivingDoctor[]> {
  const res = await api<{ doctors?: ReceivingDoctor[] }>({
    path: "/api/referral/receiving-doctors",
    query: { fromFacilityId, toFacilityId, pageSize: 100 },
  });
  return res.doctors ?? [];
}
