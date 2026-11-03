import { useEffect, useMemo, useRef, useState } from "react";

import { describeError } from "@/lib/api/errors";
import { lookupRegimens, saveRegimen } from "@/lib/api/endpoints/regimens";

import {
  applyDraft,
  draftFromLastUsed,
  draftFromLine,
  draftFromRegimen,
  EMPTY_DRAFT,
  isExpiryPrescribable,
  medicineNameKey,
  regimenStatus,
  rowErrors,
  type LastUsed,
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
  /** The doctor's explicit checkbox choices; unset = the status default. */
  const [regimenChoice, setRegimenChoice] = useState<Record<string, boolean>>(
    {}
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
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
    setRegimenChoice({});
    setShowErrors(false);
  };

  const save = async () => {
    if (saving) return;
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

    const toSave = lines.filter((p) => {
      const status = regimenStatus(
        p,
        p.drugId ? regimenByDrug[p.drugId] : undefined,
        canSave
      );
      if (status !== "new" && status !== "update") return false;
      return regimenChoice[p.id] ?? status === "new";
    });

    setSaving(true);
    try {
      const failures: string[] = [];
      const stamped: Record<string, RegimenView> = {};
      const failed = new Set<string>();
      await Promise.all(
        toSave.map(async (p) => {
          try {
            stamped[p.id] = await saveRegimen({
              facilityId,
              consultationId,
              drugId: p.drugId!,
              draft: draftFromLine(p),
            });
          } catch (e) {
            failed.add(p.id);
            failures.push(`${p.name}: ${describeError(e)}`);
          }
        })
      );
      const saved = Object.keys(stamped).length;
      if (saved > 0) {
        setRegimenByDrug((m) => {
          const next = { ...m };
          for (const r of Object.values(stamped)) next[r.drugId] = r;
          return next;
        });
        const updated = latest.current.map((p) =>
          stamped[p.id]
            ? {
                ...p,
                regimenId: stamped[p.id]!.id,
                regimenVersion: stamped[p.id]!.currentVersion,
                fillSource: "regimen" as const,
              }
            : p
        );
        latest.current = updated;
        onUpdate(updated);
      }
      // A row whose regimen failed stays changed so Save can be pressed again.
      setSnapshots((s) => {
        const next: Record<string, PlanPrescription | null> = {};
        for (const id of failed) if (id in s) next[id] = s[id] ?? null;
        return next;
      });
      setRegimenChoice((c) => {
        const next: Record<string, boolean> = {};
        for (const id of failed) if (id in c) next[id] = c[id]!;
        return next;
      });
      setShowErrors(false);
      setNotice(
        failures.length > 0
          ? { tone: "error", text: failures.join("\n") }
          : {
              tone: "success",
              text:
                saved > 0
                  ? `Done · ${saved} regimen${saved === 1 ? "" : "s"} saved`
                  : `${lines.length} medicine${lines.length === 1 ? "" : "s"} checked`,
            }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
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
      regimenChoice={regimenChoice}
      showErrors={showErrors}
      saving={saving}
      adding={adding}
      notice={notice}
      onChangeLine={changeLine}
      onRemove={removeLine}
      onRegimenChoice={(id, on) => {
        setRegimenChoice((c) => ({ ...c, [id]: on }));
        // A tick needs Save to take effect, so the row must bring up the Save bar
        // even if its values were changed before the last Save.
        const line = latest.current.find((p) => p.id === id);
        if (line) setSnapshots((s) => (id in s ? s : { ...s, [id]: line }));
      }}
      onApplyDuration={applyDurationToAll}
      onSave={() => void save()}
      onDiscard={discard}
    />
  );
}
