/** Token queue classes — mirrors Practice `lib/appointments/token-series.ts`. */

export type TokenSeries = "PRIOR" | "WALK_IN" | "EMERGENCY";

const TOKEN_SERIES_PREFIX: Record<TokenSeries, string> = {
  EMERGENCY: "E",
  PRIOR: "P",
  WALK_IN: "W",
};

export function isWalkInAppointmentType(type?: string | null): boolean {
  const t = String(type ?? "")
    .trim()
    .toLowerCase();
  return t === "walk-in" || t === "walkin" || t === "walk in";
}

export function tokenSeriesOrDefault(
  series?: TokenSeries | string | null
): TokenSeries {
  if (series === "WALK_IN" || series === "EMERGENCY" || series === "PRIOR") {
    return series;
  }
  return "PRIOR";
}

/** Walk-in / emergency queue class — patient is already at the desk. */
export function isWaitlistSeries(series?: TokenSeries | string | null): boolean {
  const s = tokenSeriesOrDefault(series);
  return s === "WALK_IN" || s === "EMERGENCY";
}

export function formatSeriesToken(
  tokenNumber: number | null | undefined,
  series?: TokenSeries | string | null
): string | null {
  if (tokenNumber == null || !Number.isFinite(tokenNumber)) return null;
  const n = Math.trunc(tokenNumber);
  if (n < 0) return null;
  const prefix = TOKEN_SERIES_PREFIX[tokenSeriesOrDefault(series)];
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/** Slot label for list rows — full token or bare class letter. */
export function formatTokenOrClass(params: {
  tokenNumber?: number | null;
  tokenSeries?: TokenSeries | string | null;
  appointmentType?: string | null;
}): string {
  const withNumber = formatSeriesToken(params.tokenNumber, params.tokenSeries);
  if (withNumber) return withNumber;

  const series =
    params.tokenSeries != null
      ? tokenSeriesOrDefault(params.tokenSeries)
      : isWalkInAppointmentType(params.appointmentType)
        ? "WALK_IN"
        : "PRIOR";
  return TOKEN_SERIES_PREFIX[series];
}
