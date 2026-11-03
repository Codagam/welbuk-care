# Receptionist walk-in booking

Receptionist-only desk flow on the Queue tab. Gate: `isReceptionistRole(user, facilityId)` (Practice role slug `receptionist`) **and** `appointment.create` (`useCanBookWalkIn`).

## Layout

- The Queue header shows a **Book walk-in** button at the right, below the facility/icon row and next to the "Today's appointments" and welcome text. Doctors see "Next Patient" in that same spot.
- The button opens a separate page, `/walk-in` (`src/app/(app)/walk-in.tsx`). After a booking succeeds, the page goes back to the list, which then refreshes.

## Fields

Mobile, patient name (new patients only), who is visiting (when the number has matches), doctor (pre-selected when there is only one doctor or a facility default), reason for visit, and a consent checkbox. All of these are required.

## Steps

| Step | Practice API | Notes |
|---|---|---|
| Lookup | `POST /api/patient/onboard/lookup` `{ facilityId, phone }` | A staff session needs `patient.create`; no phone token is needed. Returns patients on the number with `isLinkedToFacility`. |
| Classify | — | **facility**: linked here. **network**: a Welbuk patient at another facility. **new**: no match, or "someone else on this number". |
| OTP | `POST /api/otp/send` → `sessionId`; `POST /api/patient/onboard/verify-phone` → `phoneToken` | **Required** for network patients (their consent to link their record here). **Optional** for new patients (sets `isPhoneVerified`). Not shown for facility patients. |
| Patient | network: `POST /api/patient/onboard` `{ mode: "connect", phoneToken, consentGiven }`; new: `POST /api/patient/crud` `{ firstName, lastName, mobile, consentGiven, isPhoneVerified }` | The crud route does not need a DOB (onboard create does). The created patient id is reused if the booking step fails, so a retry does not create a duplicate. |
| Book | `POST /api/facility/appointments` `{ appointmentType: "Walk-in", status: "SCHEDULED", reason, fee, paymentStatus: "unpaid" }` | The server slots the walk-in and assigns the `W-n` token. The fee comes from `GET /api/doctor/availability` (best effort) and is collected at billing, like the web desk's "skip payment". This step then calls `POST /api/billing/sync-appointment-fee` without waiting for it. |

Code: `src/features/walk-in/`, `src/lib/api/endpoints/walk-in.ts`.
