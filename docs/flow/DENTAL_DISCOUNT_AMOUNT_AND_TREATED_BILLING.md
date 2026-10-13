# Dental: discount entered as an amount, and only treated work is billed

Written 2026-10-13 from the Practice code on `dev-mahadevan` (the same code is on
`staging` and `sandbox`). This spec is for the Welbuk Care tablet app. **Practice needs
no change.** Both behaviours already ship there. Care's job is to match them, and to
stop erasing data that Practice writes.

| Practice commit | What it did |
| --- | --- |
| `683e7025` (2026-10-05) | Treatment and visit-fee discounts are typed in **rupees**, not percent |
| `43f04894` (2026-10-06) | A suggested (`planned`) treatment is **never billed**; only treated work reaches the invoice |

> **Status: IMPLEMENTED in Care on 2026-10-13. Not yet tested on a device.** Sections 3–5
> are kept as the reasoning behind the code. The "Care today" column in 4.1 describes
> Care *before* that change. What was built:
>
> - **Fields Practice writes now survive a save.** `mapRawToDiagnosisEntries`,
>   `mapRawToPlanRows` and `entriesToPostBody` spread the raw object first.
>   `FindingsSheet`'s save starts from the saved finding.
> - **The discount is typed in rupees.** The Findings sheet shows **Fees (₹)** (the
>   original), **Disc (₹)** and **Net** (read-only), plus "Max discount ₹X" when the
>   rate card caps it. The cap is re-applied when a saved finding is edited. Each save
>   writes all three maps.
> - **Treated items are priced in Practice's order** (`planRowNetFeesByName`), with the
>   most authoritative source last:
>   1. the saved snapshot;
>   2. the live finding's net fee;
>   3. the row's own `original × (1 − discount%)`.
>
>   The catalogue's gross price is used only when none of these has the treatment.
> - **The plan section says which rows are billed.** Rows are labelled **Suggested**
>   ("not billed"), **Partly treated** or **Treated**. The header total counts treated
>   rows only. Care still shows no bill, because it is consultation-only.

---

## 1. Summary

1. **Completed-only billing is already enforced by the server.** Care's UI already
   follows it as well. There is little to build here. See section 3.
2. **The discount is still a percent in Care.** It must become a rupee amount, as in
   Practice. See section 5.
3. **There is a live data-loss bug, so fix it first.** Care's mappers rebuild every
   finding and plan row field by field, and they drop the discount fields. When a doctor
   opens and saves a consult in Care that was discounted in Practice:
   - the discount is silently erased;
   - the bill goes back to full price on the next billing sync;
   - the `TREATMENT_DISCOUNT` voucher disappears from the Waivers queue.

   See section 4.

---

## 2. How the flow works (the Practice model Care must match)

```
Findings sheet (diagnosis)                 Treatment plan sheet                   Invoice
──────────────────────────                 ────────────────────                   ───────
finding.suggestedTreatments  ── server ──► plan row  status "planned"    ──✗──►   not billed
  + fee / original / discount   merge      (one row per finding,
                                           keyed by diagnosisEntryId)
                                                 │ doctor ticks items under "Treated"
                                                 ▼
                                           status "in-progress" (some)   ──✓──►   billed: ticked items + provider fees
                                           status "done" (all)           ──✓──►   billed (even ₹0)
```

- **Suggested treatments are kept.** On every `POST` and `PUT /api/consult/dental`, the
  server calls `mergeDiagnosisPlannedPlanItems(plan, treatmentEntries)`
  (`practice/Welbuk_/lib/billing/merge-diagnosis-planned-plan.ts`). It:
  - upserts one `planned` row per finding, keyed by `diagnosisEntryId`;
  - drops a planned row whose finding was deleted;
  - **never touches a row that is `in-progress` or `done`.**
- **Only treated work is billed.** The rule is `isBillableTreatmentPlanRow`
  (`practice/Welbuk_/lib/billing/treatment-plan-row.ts`):
  - `done` is billed;
  - `in-progress` is billed when its fee is above ₹0;
  - `planned` is **never** billed.

  The billing sync after each save (`syncConsultationTreatmentPlanToInvoice`) reads only
  those rows. It does the same for follow-up consults, which bill only the increase over
  the source consult.
- **A discount is not a waiver line.** The TREATMENT invoice line is billed at the
  **net** (after-discount) fee. The server then works out the discount as
  `original − billed` for each treatment and records it as an APPROVED voucher with
  scope `TREATMENT_DISCOUNT` (`practice/Welbuk_/lib/billing/treatment-discount-waivers.ts`).
  This is what shows in the Waivers queue and in the "existing discounts" dialog.
  **The voucher exists only if the row still carries the original fee.** That is why the
  bug in section 4 matters.

---

## 3. Completed-only billing in Care: already correct, verify only

Care already matches the server. Check these and change nothing unless a check fails:

| Where | What it already does |
| --- | --- |
| `src/features/dental/components/PlanEditorSheet.tsx`, `statusFromSuggestedAndTreated` | none treated → `planned`; some → `in-progress`; all → `done` |
| same file, `combinedPlanTotal` | `totalFee` = treated items' fees + provider fees. Untreated suggestions are not counted |
| `src/features/dental/utils.ts`, `isPlanBillable` | same rule as the server |
| `src/features/dental/sections/DentalPlanSection.tsx` | footer explains that only done / in-progress rows are billed |

Two small follow-ups:

- **A treated item must be priced at its NET fee.** `feeForTreatmentName` first looks in
  the finding's `suggestedTreatmentFees` map, which is the net figure, and only then
  falls back to the catalogue `defaultFee`, which is the gross figure. If the finding
  cannot be found, a discounted treatment is billed at full price. Use Practice's order
  (`namedBilledFeeFromRow` → `lookupTreatmentUnitFee`). The **row's own**
  `originalFeesByName × (1 − discount%)` comes first, then the finding's net map, and
  the catalogue `defaultFee` comes last. Once `discountPctsByName` has any entry it is
  authoritative. Read the legacy `discountPct` only when that map is empty; otherwise one
  treatment's discount is applied to every treatment on the row.
- **Check the wording.** Where the plan section lists `planned` rows, label them as
  suggestions, for example "Suggested, not billed". A doctor must not read a planned fee
  as a charge.

---

## 4. Fix first: stop dropping fields Care does not know about

### 4.1 What gets lost

| Object | Field Practice writes | Meaning | Care today |
| --- | --- | --- | --- |
| finding (`treatmentEntries[]`) | `suggestedTreatmentFees` | `{ name: NET rupees }` | kept |
| finding | `suggestedTreatmentFeeBases` | `{ name: ORIGINAL rupees }` (before discount) | **dropped** |
| finding | `suggestedTreatmentDiscountPcts` | `{ name: percent }`, derived and **unrounded** | **dropped** |
| plan row (`treatmentPlanItems[]`) | `originalFeesByName` | the same originals, copied onto the row by the server merge | **dropped** |
| plan row | `discountPctsByName` | the same percents | **dropped** |
| plan row | `discountPct` | single-treatment shortcut; older rows may have only this one | **dropped** |

The fields are lost in three places:

- `mapRawToDiagnosisEntries` and `mapRawToPlanRows` in `src/features/dental/utils.ts`
  build new objects field by field.
- `entriesToPostBody` in the same file does the same on the way out.
- `PUT` replaces the whole document, and `PATCH` replaces the whole `treatmentPlanItems`
  array. So whatever Care leaves out is deleted on the server.

### 4.2 The fix

- **Keep every field you were given.** In both mappers, start the object from the raw
  value and then normalise on top of it, so fields Care does not know about survive the
  round trip:
  ```ts
  return { ...r, id: ..., status, providers, ... }   // raw first, normalised fields after
  ```
- Do the same in `entriesToPostBody`: spread `...e` first, then set the fields Care
  controls.
- Add the six fields to the types in `src/features/dental/types.ts`, all optional:
  - on `DiagnosisDetailsEntry`: `suggestedTreatmentFeeBases`, `suggestedTreatmentDiscountPcts`;
  - on `DentalTreatmentPlanRow`: `originalFeesByName`, `discountPctsByName`, `discountPct`.

  Keep the existing comment: *"Exact Practice dental JSON contracts — do not rename
  fields."*
- `PlanEditorSheet` already spreads `...row` into its draft, so the plan-row fields will
  survive once the mapper keeps them. Check that nothing between the draft and
  `patchDentalPlan` rebuilds the row field by field.

This is the general rule for every Practice JSON blob Care edits. Practice will keep
adding fields, and if Care drops what it does not know, it will erase each new one in
turn.

---

## 5. Discount entered as a rupee amount (Findings sheet)

### 5.1 The rule

- The doctor types **rupees off**. The column header is "Disc (₹)".
- **Net** = original − discount.
- The discount is limited to whichever is smaller:
  - the fee itself, so Net is never below 0;
  - the rate card's cap. The cap is still a **percent** on the catalogue
    (`TreatmentCatalogItem.maxDiscountPercent`) and is converted to rupees for this row,
    **rounded down** to the paisa. Rounding up could make the stored percent exceed the
    cap: 15% of ₹333.33 is ₹49.9995, which must give ₹49.99, not ₹50.
- An empty box means no discount, and Net = original.
- Typing in the Net (fee) box directly clears the discount and makes the typed figure the
  new original. Care already does this, and the behaviour stays.
- **Stored on save:**
  - `suggestedTreatmentFees` = NET
  - `suggestedTreatmentFeeBases` = ORIGINAL
  - `suggestedTreatmentDiscountPcts` = `(original − net) / original × 100`. Write it only
    when there is a discount, and **never round it.** The server rebuilds the billed fee
    as `original × (1 − pct/100)`, so ₹100 off ₹300 stored as `33.33` would bill
    ₹200.01. The percent is worked out from net rather than from the typed amount, so the
    two can never disagree.
- **When opening a saved finding**, take the original from
  `suggestedTreatmentFeeBases[name]`. If that is missing (older rows), use the net fee.
  The amount shown is `original − net`, or an empty box if that is under ₹0.005. Also
  look up the cap from the catalogue by name: today `emptyDraft` sets
  `maxDiscountPercent: null` when opening a saved finding, so **the cap is not enforced
  when an existing finding is edited.**

### 5.2 Code to port

Copy these from `practice/Welbuk_/components/consult/diagnosis-dialog/utils.ts`. They
are pure functions with no React. Place them in `src/features/dental/utils.ts` and delete
`applyDiscount`, the percent version.

```ts
export function formatMoneyLikeInput(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function getEffectiveDiscountCap(maxDiscountPercent?: number | null): number {
  if (typeof maxDiscountPercent === "number" && Number.isFinite(maxDiscountPercent)) {
    return Math.min(100, Math.max(0, maxDiscountPercent));
  }
  return 100;
}

/** Original fee. A discount never overwrites it. */
export function originalFeeText(row: { feeBase?: string; fee?: string }): string {
  const base = String(row.feeBase ?? "").trim();
  return base || String(row.fee ?? "").trim();
}

/** Rate-card percent cap → rupees for THIS row, rounded DOWN to the paisa. */
export function discountCapRupees(feeBase: string, maxDiscountPercent?: number | null): number {
  const base = Number(String(feeBase ?? "").trim());
  if (!Number.isFinite(base) || base <= 0) return 0;
  const pct = getEffectiveDiscountCap(maxDiscountPercent);
  return Math.floor(base * pct + 1e-6) / 100;
}

/** Net = original − amount, bounded by the cap and by the fee. Empty → original. */
export function computeDiscountedFee(feeBase: string, discountAmount: string, capRupees: number): string {
  const base = Number(String(feeBase).trim());
  if (!Number.isFinite(base) || base < 0) return "";
  const raw = String(discountAmount ?? "").trim();
  if (!raw) return formatMoneyLikeInput(base);
  const discount = Number(raw);
  if (!Number.isFinite(discount)) return formatMoneyLikeInput(base);
  const bounded = Math.min(capRupees, base, Math.max(0, discount));
  return formatMoneyLikeInput(base - bounded);
}

/** Amount for a saved row, rebuilt as original − net. "" when there is no discount. */
export function discountAmountFromFees(feeBase: string, fee: string): string {
  const base = Number(String(feeBase ?? "").trim());
  const net = Number(String(fee ?? "").trim());
  if (!Number.isFinite(base) || !Number.isFinite(net)) return "";
  const amount = base - net;
  return amount > 0.005 ? formatMoneyLikeInput(amount) : "";
}

/** The three maps written onto the finding. The percent is UNROUNDED. */
export function feeMapsFromPlanRows(
  rows: Array<{ treatmentName?: string; fee?: string; feeBase?: string; discountAmount?: string }>,
) {
  const suggestedTreatmentFees: Record<string, number> = {};
  const suggestedTreatmentFeeBases: Record<string, number> = {};
  const suggestedTreatmentDiscountPcts: Record<string, number> = {};
  for (const row of rows) {
    const name = String(row.treatmentName ?? "").trim();
    if (!name) continue;
    const net = Number(row.fee);
    if (Number.isFinite(net) && net >= 0) suggestedTreatmentFees[name] = net;
    const base = Number(originalFeeText(row));
    if (Number.isFinite(base) && base >= 0) suggestedTreatmentFeeBases[name] = base;
    if (String(row.discountAmount ?? "").trim() && base > 0 && net >= 0 && base - net > 0.005) {
      suggestedTreatmentDiscountPcts[name] = ((base - net) / base) * 100;
    }
  }
  return { suggestedTreatmentFees, suggestedTreatmentFeeBases, suggestedTreatmentDiscountPcts };
}
```

Port the Practice tests too
(`practice/Welbuk_/lib/billing/discount-amount-entry.test.ts`, the `describe("treatment
plan Disc entered as a rupee amount")` block). They fix the rounding rules in place. If
someone later "tidies" the code by rounding the percent, the tests fail instead of a
patient's bill.

### 5.3 Files to change in Care

| File | Change |
| --- | --- |
| `src/features/dental/types.ts` | `SuggestedTreatmentPlanRow.discountPct` → `discountAmount: string`. Add the six contract fields from section 4 |
| `src/features/dental/utils.ts` | Add the helpers above and remove `applyDiscount`. Make the mappers and `entriesToPostBody` keep unknown fields. Send the two new maps in `entriesToPostBody` |
| `src/features/dental/components/FindingsSheet.tsx` | `emptyDraft` (≈ line 75): hydrate `feeBase`, `discountAmount` and `maxDiscountPercent` (catalogue lookup by name). `addTreatment` (≈ line 315): `discountAmount: ""`. Patch handler (≈ lines 338–351): use `discountCapRupees` + `computeDiscountedFee`. Input (≈ line 753): rupees, label "Disc (₹)", show the cap as "max ₹X" when the cap is under 100%. Save (≈ line 418): build the maps with `feeMapsFromPlanRows` |
| `src/features/dental/components/PlanEditorSheet.tsx` | Only the net-fee lookup order from section 3 |

Out of scope:

- **Visit/consultation fee waiver.** Care has no waiver screen today. If one is added,
  `POST /api/billing/consult-fee-waiver` takes `discountAmountRupees`. That amount must
  be above ₹0 and no more than the fee. It still accepts the old `discountPercent`, but
  ignores it when an amount is present.
- **Inpatient bill discounts** (`src/features/inpatient/utils.ts`, `discountPct` /
  `overallDiscountPct`). These are **still percent in Practice too.** Leave them alone
  until Practice changes. Otherwise the two apps would disagree about the same bill.

---

## 6. Test steps (staging, a dental facility, a service whose rate card has a cap, e.g. 20%)

1. **In Care**, add a finding with two suggested treatments: Filling ₹300 and Scaling
   ₹500. On Filling, type a discount of `100`. Net shows **₹200**. Save.
2. Open the consult's bill in Practice. **There is no treatment line.** Planned work is
   not billed.
3. **In Care**, open the plan row and tick Filling under Treated. The status becomes
   **in-progress**. Save.
4. The Practice bill shows Filling at **₹200**. Practice → Billing → Waivers lists a
   **"Doctor, treatment plan"** discount of **₹100**.
5. Tick Scaling. The status becomes **done**. The bill shows **₹700** (₹200 + ₹500). The
   discount is still ₹100.
6. **Round trip from Practice (the section 4 bug):** in Practice, add a ₹50 discount to a
   new finding's treatment and save. Open the same consult in Care, change only the
   finding's note, and save. In Practice, **the ₹50 discount must still be there** in the
   finding dialog, on the bill and in Waivers. Today it is lost.
7. **Cap:** on a ₹1,000 service capped at 20%, type `500`. Net is limited to **₹800**
   (₹200 off), and the field shows "max ₹200". Reopen the saved finding and check the
   limit still applies.
8. **Rounding:** on a ₹300 fee, type `100` and treat it. The bill must read **₹200.00**,
   not ₹200.01.
9. Delete a finding that is still only planned. Its planned row disappears. A finding
   that is already treated keeps its in-progress or done row.
10. Complete the consult and try to edit the plan. The server refuses with
    `409 CONSULT_COMPLETED`. Show the server's message rather than a generic error.
