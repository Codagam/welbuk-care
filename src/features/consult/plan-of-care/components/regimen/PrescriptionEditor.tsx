import { useEffect, useMemo, useRef, useState } from "react";

import { describeError } from "@/lib/api/errors";
import { lookupRegimens, saveRegimen } from "@/lib/api/endpoints/regimens";

import {
  applyDraft,
  draftFromLastUsed,
  draftFromLine,
  draftFromRegimen,
  describeSig,
  EMPTY_DRAFT,
  formatShortDate,
  isExpiryPrescribable,
  isTextDose,
  medicineNameKey,
  rowErrors,
  type LastUsed,
  type LineDraft,
  type RegimenView,
} from "../../lineDraft";
import { newPrescriptionId } from "../../prescriptionDraftStore";
import {
  courseDays,
  normalizeDurationUnit,
  usesFreeTextDosePattern,
  type DurationUnit,
} from "../../sig";
import type { PlanPrescription } from "../../types";
import { MedicinePicker, type PickedDrug } from "./MedicinePicker";
import { PrescriptionGrid, type Notice } from "./PrescriptionGrid";
import { RegimenDialog } from "./RegimenDialog";

/** Below this age an automatically filled adult dose is flagged for checking. */
const CHILD_AGE_YEARS = 12;

/** Fields that make up the dose itself; editing one is the doctor checking it. */
const SIG_FIELDS = [
  "dosePattern",
  "foodTiming",
  "durationValue",
  "durationUnit",
  "doseNote",
] as const;

/**
 * The prescription lines of one consult, edited in place (Practice
 * prescription-editor.tsx). Picking medicines adds every row at once, filled from
 * the consult doctor's regimen, else their last prescription of it, else blank.
 * One Save checks the changed rows and applies their regimen checkboxes.
 *
 * A medicine added with no regimen opens the regimen dialog, one at a time; a
 * row's Edit button opens the same dialog. Both edit a line that is ALREADY on
 * the prescription, so skipping or cancelling never loses a medicine.
 *
 * Save does not write the prescription: that is Complete, as on the web.
 */
export function PrescriptionEditor({
  prescriptions,
  onAdd,
  onRemove,
  onUpdate,
  facilityId,
  consultationId,
  readOnly,
  patientAgeYears,
}: {
  prescriptions: PlanPrescription[];
  onAdd: (line: PlanPrescription) => void;
  onRemove: (id: string) => void;
  onUpdate: (lines: PlanPrescription[]) => void;
  facilityId: string;
  consultationId: string;
  readOnly?: boolean;
  /** Whole years, or null when unknown. Unknown must stay unknown, never a newborn. */
  patientAgeYears?: number | null;
}) {
  const childAge =
    typeof patientAgeYears === "number" && patientAgeYears < CHILD_AGE_YEARS
      ? patientAgeYears
      : null;
  const [canSave, setCanSave] = useState(false);
  const [regimenByDrug, setRegimenByDrug] = useState<
    Record<string, RegimenView>
  >({});
  const [lastUnit, setLastUnit] = useState<DurationUnit>("DAYS");
  /** Medicines picked but not yet on the list (regimen lookup in flight). */
  const [adding, setAdding] = useState(0);
  /** Rows changed since the last Save, and how each looked before (null = added). */
  const [snapshots, setSnapshots] = useState<
    Record<string, PlanPrescription | null>
  >({});
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** The consult's doctor, to say whose regimen someone else cannot change. */
  const [regimenDoctorName, setRegimenDoctorName] = useState<string | null>(
    null
  );
  /** Line ids of medicines just added with no regimen, asked one after another. */
  const [dialogQueue, setDialogQueue] = useState<string[]>([]);
  /** Dialogs already answered in this run, for "Set regimen 2 of 3". */
  const [dialogDone, setDialogDone] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const fetched = useRef(new Set<string>());
  // Saves and late lookups land after the list may have moved on, so they always
  // write over the latest lines, never the ones captured when they started.
  const latest = useRef(prescriptions);

  useEffect(() => {
    latest.current = prescriptions;
  }, [prescriptions]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const dirty = useMemo(() => {
    const live = new Set(prescriptions.map((p) => p.id));
    return new Set(Object.keys(snapshots).filter((id) => live.has(id)));
  }, [snapshots, prescriptions]);

  // Lines already on the prescription need their regimen for the checkbox.
  useEffect(() => {
    if (!facilityId || readOnly) return;
    const missing = [
      ...new Set(
        prescriptions
          .map((p) => p.drugId)
          .filter((id): id is string => Boolean(id))
      ),
    ].filter((id) => !fetched.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => fetched.current.add(id));
    let cancelled = false;
    void lookupRegimens(facilityId, missing, consultationId).then((r) => {
      if (cancelled) return;
      setRegimenByDrug((m) => ({ ...m, ...r.regimens }));
      if (!r.failed) setCanSave(r.canSave);
      if (r.doctorName) setRegimenDoctorName(r.doctorName);
    });
    return () => {
      cancelled = true;
    };
  }, [prescriptions, facilityId, consultationId, readOnly]);

  const onPrescription = useMemo(
    () =>
      new Set(
        prescriptions
          .map((p) => p.drugId)
          .filter((id): id is string => Boolean(id))
      ),
    [prescriptions]
  );
  const onPrescriptionNames = useMemo(
    () =>
      new Set(prescriptions.map((p) => medicineNameKey(p.name)).filter(Boolean)),
    [prescriptions]
  );

  const addPicked = async (usable: PickedDrug[]) => {
    const r = await lookupRegimens(
      facilityId,
      usable.map((d) => d.id),
      consultationId
    );
    const regimens: Record<string, RegimenView> = r.regimens;
    const lastUsed: Record<string, LastUsed> = r.lastUsed;
    if (r.failed) {
      setNotice({
        tone: "error",
        text: "Could not load your regimens. Set the dose in the row this time.",
      });
    } else {
      setCanSave(r.canSave);
    }
    if (r.doctorName) setRegimenDoctorName(r.doctorName);
    usable.forEach((d) => fetched.current.add(d.id));
    setRegimenByDrug((m) => ({ ...m, ...regimens }));

    const added: PlanPrescription[] = [];
    for (const d of usable) {
      const base: PlanPrescription = {
        id: newPrescriptionId(),
        name: d.name,
        drugId: d.id,
        dosageForm: d.dosageForm ?? null,
        dosePattern: "",
        foodTiming: "AF",
        duration: "",
      };
      const regimen = regimens[d.id];
      const history = regimen ? null : draftFromLastUsed(lastUsed[d.id]);
      let line: PlanPrescription;
      if (regimen) {
        line = {
          ...applyDraft(base, draftFromRegimen(regimen)),
          regimenId: regimen.id,
          regimenVersion: regimen.currentVersion,
          autoFilled: true,
          fillSource: "regimen",
        };
        setLastUnit(regimen.durationUnit);
      } else if (history) {
        line = {
          ...applyDraft(base, history),
          autoFilled: true,
          fillSource: "history",
          historyDate: lastUsed[d.id]?.prescribedAt ?? null,
        };
      } else {
        line = {
          ...applyDraft(base, {
            ...EMPTY_DRAFT,
            dosePattern: usesFreeTextDosePattern(d.dosageForm)
              ? "As Needed"
              : "",
          }),
          fillSource: "new",
        };
      }
      added.push(line);
      onAdd(line);
    }
    // Every added row counts as a change until Save, so the doctor sees them checked.
    setSnapshots((s) => {
      const next = { ...s };
      for (const line of added) next[line.id] = null;
      return next;
    });
    // A medicine with no regimen asks for one. The row is already on the list
    // (filled from history or blank), so a skipped dialog leaves a row to finish
    // inline, never a missing medicine.
    const ask = added
      .filter((line) => line.fillSource !== "regimen")
      .map((line) => line.id);
    if (ask.length > 0) {
      const live = new Set(latest.current.map((p) => p.id));
      // Nothing left to ask from an earlier run: this run counts from 1.
      if (!dialogQueue.some((id) => live.has(id))) setDialogDone(0);
      setDialogQueue((q) => [...q.filter((id) => live.has(id)), ...ask]);
    }
  };

  const handlePick = async (picked: PickedDrug[]) => {
    const expired: string[] = [];
    const duplicates: string[] = [];
    const usable = picked.filter((d) => {
      if (!isExpiryPrescribable(d.expiry)) {
        expired.push(d.name);
        return false;
      }
      // By id AND by name: a line from a template or an old draft has no id.
      const already =
        onPrescription.has(d.id) ||
        onPrescriptionNames.has(medicineNameKey(d.name)) ||
        (d.brandName
          ? onPrescriptionNames.has(medicineNameKey(d.brandName))
          : false);
      if (already) duplicates.push(d.name);
      return !already;
    });
    if (expired.length > 0) {
      setNotice({
        tone: "error",
        text: `Expired, cannot be prescribed: ${expired.join(", ")}`,
      });
    } else if (duplicates.length > 0) {
      setNotice({
        tone: "error",
        text: `Already on the prescription: ${duplicates.join(", ")}`,
      });
    }
    if (usable.length === 0) return;
    // The lookup takes a moment. Say so, or the list looks unchanged and a quick
    // Complete goes out without the medicines just picked.
    setAdding(usable.length);
    try {
      await addPicked(usable);
    } finally {
      setAdding(0);
    }
  };

  const changeLine = (id: string, patch: Partial<PlanPrescription>) => {
    const prev = latest.current.find((p) => p.id === id);
    if (!prev) return;
    let next: PlanPrescription = { ...prev, ...patch };
    if ("durationValue" in patch || "durationUnit" in patch) {
      const days =
        next.durationValue && next.durationUnit
          ? courseDays({
              durationValue: next.durationValue,
              durationUnit: next.durationUnit,
            })
          : null;
      next = { ...next, duration: days != null ? String(days) : "" };
      const unit = normalizeDurationUnit(next.durationUnit);
      if (unit) setLastUnit(unit);
    }
    // Touching the dose is the doctor checking it. Quantity alone does not count.
    if (SIG_FIELDS.some((f) => f in patch)) {
      next = { ...next, autoFilled: false };
    }
    const lines = latest.current.map((p) => (p.id === id ? next : p));
    latest.current = lines;
    onUpdate(lines);
    setSnapshots((s) => (id in s ? s : { ...s, [id]: prev }));
  };

  // ── Regimen dialog (row Edit button + medicines added with no regimen) ──
  // A queued row removed before its turn is simply skipped.
  const liveQueue = dialogQueue.filter((id) =>
    prescriptions.some((p) => p.id === id)
  );
  const queuedLine = liveQueue[0]
    ? prescriptions.find((p) => p.id === liveQueue[0])
    : undefined;
  const editLine = editId
    ? prescriptions.find((p) => p.id === editId)
    : undefined;
  // The row Edit button wins over the queue; the queue resumes after it.
  const dialogLine = editLine ?? queuedLine;
  const dialogFromQueue = !editLine && Boolean(queuedLine);

  const closeDialog = (id: string) => {
    if (editId === id) {
      setEditId(null);
      return;
    }
    if (liveQueue[0] === id) {
      const rest = liveQueue.slice(1);
      setDialogQueue(rest);
      // A finished run starts counting again from 1.
      setDialogDone((n) => (rest.length === 0 ? 0 : n + 1));
    }
  };

  const saveLineFromDialog = async (
    id: string,
    draft: LineDraft,
    updateFuture: boolean
  ) => {
    const prev = latest.current.find((p) => p.id === id);
    if (!prev) return closeDialog(id);
    let next: PlanPrescription = {
      ...applyDraft(prev, draft),
      autoFilled: false,
    };
    if (draft.durationUnit) setLastUnit(draft.durationUnit);

    if (updateFuture && canSave && next.drugId) {
      setDialogBusy(true);
      try {
        // A new version of the doctor's regimen; the API keeps every version.
        const regimen = await saveRegimen({
          facilityId,
          consultationId,
          drugId: next.drugId,
          draft: draftFromLine(next),
        });
        next = {
          ...next,
          regimenId: regimen.id,
          regimenVersion: regimen.currentVersion,
          fillSource: "regimen",
        };
        setRegimenByDrug((m) => ({ ...m, [regimen.drugId]: regimen }));
        setNotice({
          tone: "success",
          text: `Regimen for ${next.name} saved (v${regimen.currentVersion})`,
        });
      } catch (e) {
        // The dialog stays open so the doctor can retry or untick the box.
        setNotice({ tone: "error", text: `${next.name}: ${describeError(e)}` });
        return;
      } finally {
        setDialogBusy(false);
      }
    }

    const current = latest.current.find((p) => p.id === id) ?? prev;
    const lines = latest.current.map((p) =>
      p.id === id ? { ...next, qtyPrescribed: current.qtyPrescribed } : p
    );
    latest.current = lines;
    onUpdate(lines);
    // The row stays a change until the table's Save, like an inline edit.
    setSnapshots((s) => (id in s ? s : { ...s, [id]: prev }));
    closeDialog(id);
  };

  // The dialog is keyed on the row and reads this only when it opens, so later
  // renders cannot reset what the doctor is typing.
  const dialogInitial = dialogLine ? draftFromLine(dialogLine) : EMPTY_DRAFT;
  const dialogRegimen = dialogLine?.drugId
    ? regimenByDrug[dialogLine.drugId]
    : undefined;
  const dialogHistoryNotice =
    dialogFromQueue &&
    dialogLine?.fillSource === "history" &&
    dialogInitial.dosePattern
      ? `Found on your previous prescription${
          dialogLine.historyDate
            ? ` (${formatShortDate(dialogLine.historyDate)})`
            : ""
        }: ${describeSig(dialogInitial)}. Use it?`
      : null;
  const doctorLabel = regimenDoctorName
    ? `Dr. ${regimenDoctorName.replace(/^dr\.?\s*/i, "")}`
    : "the consult's doctor";

  const removeLine = (id: string) => {
    onRemove(id);
    setSnapshots((s) => {
      if (!(id in s)) return s;
      const next = { ...s };
      delete next[id];
      return next;
    });
  };

  const applyDurationToAll = (value: number, unit: DurationUnit) => {
    const before = latest.current;
    const changed: Record<string, PlanPrescription> = {};
    const lines = before.map((p) => {
      const next = applyDraft(p, {
        ...draftFromLine(p),
        durationValue: value,
        durationUnit: unit,
      });
      if (
        next.duration === p.duration &&
        next.durationUnit === p.durationUnit &&
        next.durationValue === p.durationValue
      ) {
        return p;
      }
      changed[p.id] = p;
      return { ...next, autoFilled: false };
    });
    latest.current = lines;
    onUpdate(lines);
    setSnapshots((s) => {
      const out = { ...s };
      for (const [id, prev] of Object.entries(changed)) {
        if (!(id in out)) out[id] = prev;
      }
      return out;
    });
    setLastUnit(unit);
    setNotice({
      tone: "success",
      text: `Duration set for ${before.length} medicines`,
    });
  };

  const discard = () => {
    const restored = latest.current
      .filter((p) => snapshots[p.id] !== null)
      .map((p) => (p.id in snapshots ? snapshots[p.id]! : p));
    latest.current = restored;
    onUpdate(restored);
    setSnapshots({});
    setShowErrors(false);
  };

  const save = () => {
    const lines = latest.current.filter((p) => dirty.has(p.id));
    if (lines.length === 0) return;
    const invalid = lines.filter((p) => Object.keys(rowErrors(p)).length > 0);
    if (invalid.length > 0) {
      setShowErrors(true);
      setNotice({
        tone: "error",
        text:
          invalid.length === 1
            ? `${invalid[0]!.name} is not complete yet`
            : `${invalid.length} medicines are not complete yet`,
      });
      return;
    }

    // Regimens change only through the Set / Edit dialog, never as a side effect
    // of this Save, which just confirms the rows are complete.
    setSnapshots({});
    setShowErrors(false);
    setNotice({
      tone: "success",
      text: `${lines.length} medicine${lines.length === 1 ? "" : "s"} checked`,
    });
  };

  return (
    <>
      {dialogLine && !readOnly ? (
        <RegimenDialog
          key={dialogLine.id}
          drugName={dialogLine.name}
          step={
            dialogFromQueue
              ? {
                  index: dialogDone + 1,
                  total: dialogDone + liveQueue.length,
                }
              : undefined
          }
          initial={dialogInitial}
          initialTextMode={isTextDose(
            dialogInitial.dosePattern,
            dialogLine.dosageForm
          )}
          currentRegimen={
            dialogRegimen
              ? {
                  label: describeSig(dialogRegimen),
                  version: dialogRegimen.currentVersion,
                }
              : null
          }
          historyNotice={dialogHistoryNotice}
          childAge={childAge}
          defaultUnit={lastUnit}
          canSaveRegimen={canSave && Boolean(dialogLine.drugId)}
          updateFutureDefault={!dialogRegimen}
          regimenLockedReason={
            !dialogLine.drugId
              ? "This medicine is not from the catalogue, so it cannot be saved as a regimen."
              : `Only ${doctorLabel} can change their regimen. Signed in as someone else, this saves for this prescription only.`
          }
          busy={dialogBusy}
          onCancel={() => closeDialog(dialogLine.id)}
          onSave={(draft, updateFuture) =>
            void saveLineFromDialog(dialogLine.id, draft, updateFuture)
          }
        />
      ) : null}
      <PrescriptionGrid
      prescriptions={prescriptions}
      regimenByDrug={regimenByDrug}
      readOnly={readOnly}
      childAge={childAge}
      canSave={canSave}
      picker={
        !readOnly && facilityId ? (
          <MedicinePicker
            facilityId={facilityId}
            consultationId={consultationId}
            excludeDrugIds={onPrescription}
            excludeNameKeys={onPrescriptionNames}
            onAdd={(picked) => void handlePick(picked)}
          />
        ) : null
      }
      defaultUnit={lastUnit}
      dirty={dirty}
      showErrors={showErrors}
      saving={false}
      adding={adding}
      notice={notice}
      onChangeLine={changeLine}
      onRemove={removeLine}
      onApplyDuration={applyDurationToAll}
      onSave={save}
      onDiscard={discard}
      onEditRegimen={setEditId}
    />
    </>
  );
}
