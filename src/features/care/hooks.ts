import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignStaff,
  endAssignment,
  listCalls,
  listMyAssignments,
  raiseCall,
  updateCall,
} from "@/lib/api/endpoints/care";
import { useFacilityId } from "@/lib/auth/store";

export function useMyAssignments() {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["assignments", facilityId],
    enabled: !!facilityId,
    queryFn: () => listMyAssignments(facilityId!),
  });
}

export function useFacilityCalls() {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["calls", facilityId],
    enabled: !!facilityId,
    refetchInterval: 20_000,
    queryFn: () => listCalls(facilityId!, false),
  });
}

export function useAssignStaff() {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      patientId: string;
      staffUserId: string;
      scope?: "VISIT" | "STANDING";
      appointmentId?: string;
      role?: string;
    }) => assignStaff({ facilityId: facilityId!, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useEndAssignment() {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (id: string) => endAssignment(id, facilityId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useRaiseCall() {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      patientId: string;
      type?: string;
      priority?: string;
      note?: string;
      appointmentId?: string;
    }) => raiseCall({ facilityId: facilityId!, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calls"] }),
  });
}

export function useUpdateCall() {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      id: string;
      action: "acknowledge" | "start" | "resolve" | "cancel";
    }) => updateCall(input.id, facilityId!, input.action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calls"] }),
  });
}
