import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { useDentalDiagnosis } from "./useDentalDiagnosis";

type DentalCtx = ReturnType<typeof useDentalDiagnosis>;

const Ctx = createContext<DentalCtx | null>(null);

export function DentalConsultProvider({
  consultationId,
  appointmentId,
  facilityId,
  defaultDoctorId,
  priorDentalConsultationId,
  locked = false,
  children,
}: {
  consultationId: string;
  appointmentId?: string;
  facilityId?: string;
  defaultDoctorId?: string;
  priorDentalConsultationId?: string | null;
  locked?: boolean;
  children: ReactNode;
}) {
  const value = useDentalDiagnosis({
    consultationId,
    appointmentId,
    facilityId,
    enabled: true,
    defaultDoctorId,
    priorDentalConsultationId,
    locked,
  });
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDentalConsult(): DentalCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useDentalConsult must be used within DentalConsultProvider"
    );
  }
  return ctx;
}

/** Safe outside provider (non-dental consults). */
export function useDentalFlushOptional(): (() => Promise<boolean>) | null {
  return useContext(Ctx)?.flushDental ?? null;
}
