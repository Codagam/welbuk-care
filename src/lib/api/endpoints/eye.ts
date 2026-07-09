import { api } from "@/lib/api/client";
import type { EyeData, EyeRefraction } from "@/features/eye/types";

export function getEye(consultationId: string): Promise<EyeData> {
  return api({ path: "/api/consult/eye", query: { consultationId } });
}

/**
 * Save the current refraction / final Rx. POST keys off appointmentId and does
 * NOT flip status when saving current refraction (only previousRefraction does).
 */
export function saveEyeRefraction(
  appointmentId: string,
  refraction: EyeRefraction,
  eyeStates: Record<string, unknown> = {}
): Promise<unknown> {
  return api({
    path: "/api/consult/eye",
    method: "POST",
    body: { appointmentId, eyeStates, refraction },
  });
}
