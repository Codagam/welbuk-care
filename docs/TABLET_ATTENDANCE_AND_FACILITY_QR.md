# Tablet Attend Marker + Facility QR — Care Notes

> Full face-attendance API contract:  
> [`FACE_RECOGNITION_ATTENDANCE_IMPLEMENTATION.md`](./FACE_RECOGNITION_ATTENDANCE_IMPLEMENTATION.md)  
> (also in Practice `docs/`).

**Care header cluster:** Attend (face) → Facility QR.

## Attend Marker (navbar contract)

Live preview → on-device face-api 128-D → `POST identify` every 1.5s → user confirms → `POST kiosk-attendance`.  
**No** ImagePicker selfie upload. **No** auto-punch. Soft HTTP 200: unmatched / alreadyPunched / cooldown / ipBlocked.

## Facility QR

`GET /api/facility/crud` + wrapper-qr proxy; local cache keyed by `userId + role + name + facilityId`.

## Design tokens

Brand `#fd006a`; icon ≥44pt; face preview `aspect-video`; punch CTA full-width primary.
