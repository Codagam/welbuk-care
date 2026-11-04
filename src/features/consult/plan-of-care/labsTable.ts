/**
 * What the Labs card shows, ported from Practice components/consult/lab-test-needed-card
 * and the referral table on its consult page. Pure, so it can be checked outside the app.
 */

export type LabReportRow = {
  date?: string;
  test?: string;
  result?: string;
};

export type ReferralListRow = {
  id?: string;
  createdAt?: string;
  referralType?: string;
  tests?: string[] | string;
  status?: string;
};

export type ReferralTableRow = {
  id: string;
  date: string;
  type: string;
  mode: string;
  tests: string;
  status: string;
};

const DASH = "—";

/** A result that only repeats the test's name says nothing, so it reads as a dash. */
export function resultLabel(test?: string, result?: string): string {
  const t = (test ?? "").trim();
  const r = (result ?? "").trim();
  if (!r || r.toLowerCase() === t.toLowerCase()) return DASH;
  return r;
}

/** Newest first, then the search across date, test and result. */
export function filterLabReports<T extends LabReportRow>(
  reports: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  const rows = [...reports].sort((a, b) => {
    const ad = a.date ?? "";
    const bd = b.date ?? "";
    return bd > ad ? 1 : bd < ad ? -1 : 0;
  });
  if (!q) return rows;
  return rows.filter((r) =>
    [r.date, r.test, r.result].some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(q)
    )
  );
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Both directions in one list, one row per referral, newest first. */
export function buildReferralRows(
  incoming: ReferralListRow[],
  outgoing: ReferralListRow[]
): ReferralTableRow[] {
  const byId = new Map<
    string,
    { row: ReferralListRow; mode: "incoming" | "outgoing" }
  >();
  for (const row of incoming) {
    if (row.id) byId.set(String(row.id), { row, mode: "incoming" });
  }
  for (const row of outgoing) {
    if (row.id) byId.set(String(row.id), { row, mode: "outgoing" });
  }
  const time = (value?: string) => new Date(value ?? "").getTime() || 0;
  return [...byId.entries()]
    .sort((a, b) => time(b[1].row.createdAt) - time(a[1].row.createdAt))
    .map(([id, { row, mode }]) => {
      const created = row.createdAt ? new Date(row.createdAt) : null;
      const tests = Array.isArray(row.tests)
        ? row.tests.map(String).join(", ")
        : (row.tests ?? "");
      return {
        id,
        date:
          created && !Number.isNaN(created.getTime())
            ? created.toLocaleString("en-GB")
            : DASH,
        type: row.referralType || DASH,
        mode: capitalize(mode),
        tests: tests || DASH,
        status: capitalize((row.status || DASH).toLowerCase().replace(/_/g, " ")),
      };
    });
}
