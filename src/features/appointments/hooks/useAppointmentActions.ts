import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelFacilityAppointment,
  createCashVisitFeeRefund,
  deleteFacilityAppointment,
  disburseRefund,
  getDoctorDaySlots,
  getInvoiceByNumber,
  refundAppointmentPayment,
  updateFacilityAppointment,
} from "@/lib/api/endpoints/appointments";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { useHasPermission, useCanDelete, useCanWrite } from "@/features/permissions";
import type { AppointmentActionPermissions } from "../lib/appointmentActions";

/** The three permission answers the row actions are decided from. */
export function useAppointmentActionPermissions(): AppointmentActionPermissions {
  const canUpdate = useCanWrite("appointment");
  const canCancelAction = useHasPermission("action.appointment.cancel");
  const canDelete = useCanDelete("appointment");
  return {
    canUpdate,
    // Cancelling is a status change on the same PUT as any edit, so update is
    // enough; the dedicated cancel key also grants it on its own.
    canCancel: canUpdate || canCancelAction,
    canDelete,
  };
}

/** Day slot grid for a reschedule. Only fetched while the picker is open. */
export function useDoctorDaySlots(params: {
  doctorId?: string | null;
  date: string;
  excludeAppointmentId?: string;
  enabled: boolean;
}) {
  const facilityId = useFacilityId();
  const enabled =
    params.enabled &&
    !!facilityId &&
    !!params.doctorId &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.date);

  return useQuery({
    queryKey: [
      "doctor-day-slots",
      facilityId,
      params.doctorId,
      params.date,
      params.excludeAppointmentId ?? "",
    ],
    enabled,
    staleTime: 0,
    queryFn: ({ signal }) =>
      getDoctorDaySlots(
        {
          facilityId: facilityId!,
          doctorId: params.doctorId!,
          date: params.date,
          excludeAppointmentId: params.excludeAppointmentId,
        },
        signal
      ),
  });
}

function useInvalidateAppointments() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["appointments"] });
    void qc.invalidateQueries({ queryKey: ["doctor-day-slots"] });
  };
}

export function useUpdateAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: (body: Record<string, unknown> & { id: string }) =>
      updateFacilityAppointment(body),
    onSuccess: invalidate,
  });
}

export type CancelRefund =
  | { kind: "none" }
  /** Online payment: refunded through the gateway before the cancel. */
  | { kind: "gateway"; paymentId: string; paymentMethod: string; amount: number }
  /** Cash handed back at the desk: recorded on the bill after the cancel. */
  | {
      kind: "cash";
      facilityId: string;
      invoiceNumber: string;
      amount: number;
    };

/**
 * Cancel with the refund Practice's cancel dialog does alongside it.
 *
 * Gateway refunds run first (as Practice does). Cash refunds run AFTER the
 * cancel: a failed cancel then moves no money, and a failed refund leaves a
 * cancelled visit whose fee can still be refunded from the bill — never paid
 * out twice. That second case resolves with `cashRefundError` rather than
 * throwing, because the visit is already cancelled.
 * @see practice/Welbuk_/components/appointments/cancel-appointment-dialog.tsx
 */
export function useCancelAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      cancelReason: string;
      refund: CancelRefund;
    }): Promise<{ cashRefundError?: string }> => {
      const { refund } = params;
      if (refund.kind === "gateway") {
        await refundAppointmentPayment({
          appointmentId: params.id,
          paymentId: refund.paymentId,
          paymentMethod: refund.paymentMethod,
          amount: refund.amount,
          reason: params.cancelReason,
        });
      }

      await cancelFacilityAppointment({
        id: params.id,
        cancelReason: params.cancelReason,
      });

      if (refund.kind === "cash") {
        try {
          const { invoice } = await getInvoiceByNumber({
            facilityId: refund.facilityId,
            invoiceNumber: refund.invoiceNumber,
          });
          if (!invoice?.id) {
            throw new Error("Could not find the bill for this visit");
          }
          const { refund: raised } = await createCashVisitFeeRefund({
            facilityId: refund.facilityId,
            invoiceId: invoice.id,
            visitFeeRupees: refund.amount,
            reasonNote: params.cancelReason,
          });
          // PENDING_APPROVAL (over the auto-approve limit) has nothing to pay
          // out yet; it waits in the approval queue.
          if (raised?.status === "APPROVED") {
            await disburseRefund({
              facilityId: refund.facilityId,
              refundId: raised.id,
            });
          }
        } catch (e) {
          return { cashRefundError: describeError(e) };
        }
      }
      return {};
    },
    // A gateway refund can succeed before a failed cancel, so refresh either way.
    onSettled: invalidate,
  });
}

export function useDeleteAppointment() {
  const invalidate = useInvalidateAppointments();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (params: { id: string; reason?: string }) => {
      if (!facilityId) throw new Error("Select a facility first");
      return deleteFacilityAppointment({ ...params, facilityId });
    },
    onSuccess: invalidate,
  });
}
