import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import {
  getFamily,
  GUARDIAN_RELATIONS,
  linkGuardian,
  unlinkGuardian,
  type FamilyPerson,
  type GuardianRelation,
} from "@/lib/api/endpoints/family";

import {
  BRAND,
  ChoiceChips,
  Dialog,
  EmptyNote,
  formatShortDate,
  PatientSearchList,
  patientOptionName,
  ReasonDialog,
  showToast,
} from "../components/kit";

const RELATION_LABEL: Record<string, string> = {
  MOTHER: "Mother",
  FATHER: "Father",
  GUARDIAN: "Guardian",
};

const familyKey = (patientId: string, facilityId: string) => [
  "patient-family",
  patientId,
  facilityId,
];

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

type LinkDialogState = {
  direction: "parent" | "child";
  relation?: GuardianRelation;
  lockRelation?: boolean;
  suggested?: { id: string; name: string } | null;
};

/**
 * "Family" on the patient record — Care port of Practice
 * `components/patient/family/family-card.tsx`. Two links kept apart on
 * purpose: who is RESPONSIBLE for a child (parents / guardians, ends at 18),
 * and which HOUSEHOLD a person belongs to (head of house, edited on the
 * patient form).
 */
export function FamilyCard({
  patientId,
  facilityId,
  patientName,
  canEdit,
}: {
  /** Route id — numeric `patientId` or Mongo id; the API accepts both. */
  patientId: string;
  facilityId: string;
  patientName: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const key = familyKey(patientId, facilityId);
  const q = useQuery({
    queryKey: key,
    queryFn: () => getFamily(patientId, facilityId),
    enabled: !!patientId && !!facilityId,
  });
  const data = q.data;

  const [dialog, setDialog] = useState<LinkDialogState | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<{
    linkId: string;
    label: string;
  } | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["patient-family"] });

  const link = useMutation({
    mutationFn: (args: {
      direction: "parent" | "child";
      otherPatientId: string;
      relation: GuardianRelation;
    }) =>
      linkGuardian({
        facilityId,
        childPatientId:
          args.direction === "parent" ? patientId : args.otherPatientId,
        guardianPatientId:
          args.direction === "parent" ? args.otherPatientId : patientId,
        relation: args.relation,
      }),
    onSuccess: async (res, args) => {
      showToast(`${RELATION_LABEL[args.relation]} linked`);
      await invalidate();
      // The father is ALWAYS asked, never inferred — and only from the
      // child's side, where "whose father" is unambiguous.
      if (res.askFather && args.direction === "parent") {
        const fresh = await qc.fetchQuery({
          queryKey: key,
          queryFn: () => getFamily(patientId, facilityId),
        });
        const f = fresh.suggestions.father;
        setDialog({
          direction: "parent",
          relation: "FATHER",
          lockRelation: true,
          suggested: f?.id && f.name ? { id: f.id, name: f.name } : null,
        });
        return;
      }
      setDialog(null);
    },
    onError: (e) => showToast(describeError(e), "error"),
  });

  const unlink = useMutation({
    mutationFn: (args: { linkId: string; reason: string }) =>
      unlinkGuardian({ facilityId, ...args }),
    onSuccess: async () => {
      showToast("Link removed");
      setUnlinkTarget(null);
      await invalidate();
    },
    onError: (e) => showToast(describeError(e), "error"),
  });

  const head = data?.household.head;
  const showHousehold =
    !!head && (!head.isThisPatient || (data?.household.members.length ?? 0) > 0);
  const nothing =
    data &&
    data.parents.length === 0 &&
    data.children.length === 0 &&
    !showHousehold;
  const firstName = patientName.split(" ")[0] || "this patient";

  const openPatient = (p: FamilyPerson) => {
    if (!p.visibleHere || p.patientId == null) return;
    router.push({
      pathname: "/patients/[id]",
      params: { id: String(p.patientId) },
    });
  };

  return (
    <SectionChrome
      title="Family"
      icon="people-outline"
      right={
        canEdit && data ? (
          <View className="flex-row gap-2">
            <SmallAction
              label="Parent"
              onPress={() => setDialog({ direction: "parent" })}
            />
            <SmallAction
              label="Child"
              onPress={() => setDialog({ direction: "child" })}
            />
          </View>
        ) : undefined
      }
    >
      <Text className="mb-3 text-xs text-neutral-500">
        Parents and children, and the household this patient belongs to.
      </Text>

      {q.isLoading ? (
        <View className="flex-row items-center gap-2 py-4">
          <ActivityIndicator color={BRAND} />
          <Text className="text-sm text-neutral-500">Loading family…</Text>
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : nothing ? (
        <EmptyNote
          icon="people-outline"
          title="No family linked yet"
          description="Link a mother, father or guardian, or this patient's children, to move between their records."
        />
      ) : data ? (
        <View className="gap-5">
          {data.suggestions.headAsGuardian && canEdit ? (
            <View className="gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2.5">
              <Text className="text-sm text-neutral-800">
                Recorded as a child of{" "}
                <Text className="font-semibold">
                  {data.suggestions.headAsGuardian.name}
                </Text>{" "}
                in the household. Add them as a parent?
              </Text>
              <View className="flex-row">
                <SmallAction
                  label="Review"
                  icon={null}
                  onPress={() => {
                    const h = data.suggestions.headAsGuardian;
                    setDialog({
                      direction: "parent",
                      relation: h?.gender === "MALE" ? "FATHER" : "MOTHER",
                      suggested:
                        h?.id && h.name ? { id: h.id, name: h.name } : null,
                    });
                  }}
                />
              </View>
            </View>
          ) : null}

          {data.parents.length > 0 ? (
            <Group title="Parents & guardians">
              {data.parents.map((p) => (
                <PersonRow
                  key={p.linkId}
                  person={p}
                  roleLabel={RELATION_LABEL[p.relation] ?? p.relation}
                  icon="person-outline"
                  meta={
                    !p.active ? (
                      <View className="mt-1 self-start rounded bg-neutral-200 px-1.5 py-0.5">
                        <Text className="text-[10px] font-medium text-neutral-700">
                          Ended at 18
                        </Text>
                      </View>
                    ) : null
                  }
                  onOpen={() => openPatient(p)}
                  onUnlink={
                    canEdit
                      ? () =>
                          setUnlinkTarget({
                            linkId: p.linkId,
                            label: RELATION_LABEL[p.relation] ?? "Parent",
                          })
                      : undefined
                  }
                />
              ))}
            </Group>
          ) : null}

          {data.children.length > 0 ? (
            <Group title="Children">
              {data.children.map((c) => (
                <PersonRow
                  key={c.linkId}
                  person={c}
                  roleLabel={`Child · ${firstName} is ${(
                    RELATION_LABEL[c.relation] ?? c.relation
                  ).toLowerCase()}`}
                  icon="happy-outline"
                  meta={
                    c.visibleHere ? (
                      <Text
                        className={`mt-0.5 text-[11px] ${
                          c.active ? "text-neutral-500" : "text-amber-700"
                        }`}
                      >
                        {c.active
                          ? c.endsOn
                            ? `Guardianship until ${formatShortDate(c.endsOn)}`
                            : "No date of birth — treated as a minor"
                          : "Adult — guardianship ended"}
                      </Text>
                    ) : null
                  }
                  onOpen={() => openPatient(c)}
                  onUnlink={
                    canEdit
                      ? () =>
                          setUnlinkTarget({ linkId: c.linkId, label: "Child" })
                      : undefined
                  }
                />
              ))}
            </Group>
          ) : null}

          {showHousehold && head ? (
            <Group title="Household" icon="home-outline">
              {!head.isThisPatient ? (
                <PersonRow
                  person={head}
                  roleLabel={`Head of house${
                    data.household.relationToHead
                      ? ` · this patient is ${data.household.relationToHead.toLowerCase()}`
                      : ""
                  }`}
                  icon="home-outline"
                  onOpen={() => openPatient(head)}
                />
              ) : null}
              {data.household.members.map((m, i) => (
                <PersonRow
                  key={m.id ?? `hidden-${i}`}
                  person={m}
                  roleLabel={titleCase(m.relationToHead) || "Member"}
                  icon="person-outline"
                  onOpen={() => openPatient(m)}
                />
              ))}
              <Text className="text-[11px] text-neutral-500">
                The household is changed on the patient form (same mobile
                number).
              </Text>
            </Group>
          ) : null}
        </View>
      ) : null}

      {dialog ? (
        <FamilyLinkDialog
          key={`${dialog.direction}-${dialog.relation ?? ""}-${dialog.lockRelation ? 1 : 0}`}
          onClose={() => setDialog(null)}
          facilityId={facilityId}
          direction={dialog.direction}
          thisPatientName={patientName}
          initialRelation={dialog.relation}
          lockRelation={dialog.lockRelation}
          suggested={dialog.suggested}
          pending={link.isPending}
          onSubmit={({ otherPatientId, relation }) =>
            link.mutate({ direction: dialog.direction, otherPatientId, relation })
          }
        />
      ) : null}

      <ReasonDialog
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        title={`Remove this ${unlinkTarget?.label.toLowerCase() ?? ""} link?`}
        description="The link is kept in the history with your name and reason. Neither patient record is changed."
        confirmLabel="Remove link"
        placeholder="e.g. Linked to the wrong patient"
        missingMessage="Say why this link is being removed."
        pending={unlink.isPending}
        onConfirm={(reason) =>
          unlinkTarget &&
          unlink.mutate({ linkId: unlinkTarget.linkId, reason })
        }
      />
    </SectionChrome>
  );
}

function SmallAction({
  label,
  onPress,
  icon = "add",
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[36px] flex-row items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 active:bg-neutral-50"
    >
      {icon ? <Ionicons name={icon} size={14} color="#374151" /> : null}
      <Text className="text-sm font-medium text-neutral-800">{label}</Text>
    </Pressable>
  );
}

function Group({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5">
        {icon ? <Ionicons name={icon} size={13} color="#6b7280" /> : null}
        <Text className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * One relative. Visible here → opens their record. Registered elsewhere → a
 * muted row with no name: the link exists, the person is not ours to show.
 */
function PersonRow({
  person,
  roleLabel,
  meta,
  icon,
  onOpen,
  onUnlink,
}: {
  person: Pick<
    FamilyPerson,
    "name" | "patientId" | "ageLabel" | "gender" | "visibleHere"
  >;
  roleLabel: string;
  meta?: ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  onOpen: () => void;
  onUnlink?: () => void;
}) {
  const openable = person.visibleHere && person.patientId != null;
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
      <Pressable
        onPress={openable ? onOpen : undefined}
        disabled={!openable}
        className="min-w-0 flex-1 flex-row items-center gap-3"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-neutral-100">
          <Ionicons name={icon} size={16} color="#6b7280" />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            className={`text-sm font-medium ${
              person.visibleHere ? "text-neutral-900" : "text-neutral-500"
            }`}
          >
            {person.visibleHere ? person.name : "Registered at another clinic"}
          </Text>
          <Text className="text-xs text-neutral-500">
            {roleLabel}
            {person.ageLabel ? ` · ${person.ageLabel}` : ""}
            {person.gender ? ` · ${titleCase(person.gender)}` : ""}
          </Text>
          {meta}
        </View>
        <Ionicons
          name={openable ? "chevron-forward" : "eye-off-outline"}
          size={16}
          color="#9ca3af"
          accessibilityLabel={openable ? undefined : "Not registered here"}
        />
      </Pressable>
      {onUnlink ? (
        <Pressable
          onPress={onUnlink}
          hitSlop={8}
          accessibilityLabel={`Remove ${roleLabel.toLowerCase()} link`}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-neutral-100"
        >
          <Ionicons name="unlink-outline" size={17} color="#6b7280" />
        </Pressable>
      ) : null}
    </View>
  );
}

function FamilyLinkDialog({
  onClose,
  facilityId,
  direction,
  thisPatientName,
  initialRelation,
  lockRelation,
  suggested,
  pending,
  onSubmit,
}: {
  onClose: () => void;
  facilityId: string;
  direction: "parent" | "child";
  thisPatientName: string;
  initialRelation?: GuardianRelation;
  lockRelation?: boolean;
  suggested?: { id: string; name: string } | null;
  pending: boolean;
  onSubmit: (args: {
    otherPatientId: string;
    relation: GuardianRelation;
  }) => void;
}) {
  const [relation, setRelation] = useState<GuardianRelation>(
    initialRelation ?? "MOTHER"
  );
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(
    suggested ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const title =
    direction === "parent"
      ? lockRelation
        ? "Link the father too?"
        : `Link a parent of ${thisPatientName}`
      : `Link a child of ${thisPatientName}`;
  const roleQuestion =
    direction === "parent"
      ? "Who are they to the child?"
      : `Who is ${thisPatientName} to the child?`;

  const submit = () => {
    if (!picked) {
      setError(direction === "parent" ? "Choose the parent." : "Choose the child.");
      return;
    }
    setError(null);
    onSubmit({ otherPatientId: picked.id, relation });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={
        lockRelation
          ? "Only if he is part of the child's care. You can skip this and add him later."
          : "They must already be registered at this clinic. The link ends on the child's 18th birthday."
      }
      footer={
        <>
          <Button
            label={lockRelation ? "Not now" : "Cancel"}
            variant="outline"
            size="md"
            onPress={onClose}
            disabled={pending}
          />
          <Button
            label={`Link ${direction === "parent" ? RELATION_LABEL[relation].toLowerCase() : "child"}`}
            size="md"
            loading={pending}
            onPress={submit}
          />
        </>
      }
    >
      {!lockRelation ? (
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-neutral-700">
            {roleQuestion}
          </Text>
          <ChoiceChips
            options={GUARDIAN_RELATIONS}
            value={relation}
            onChange={setRelation}
            labels={RELATION_LABEL as Record<GuardianRelation, string>}
          />
        </View>
      ) : null}

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-neutral-700">
          {direction === "parent" ? RELATION_LABEL[relation] : "Child"}
        </Text>
        {picked ? (
          <View className="flex-row items-center justify-between rounded-xl border border-neutral-300 px-3 py-2">
            <Text className="text-sm font-medium text-neutral-900">
              {picked.name}
            </Text>
            <Pressable onPress={() => setPicked(null)} hitSlop={8}>
              <Text className="text-sm font-medium text-brand">Change</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="text-xs text-neutral-500">
              Search by name, phone or patient ID.
            </Text>
            <PatientSearchList
              facilityId={facilityId}
              onSelect={(p) => {
                setPicked({ id: p.id, name: patientOptionName(p) });
                setError(null);
              }}
            />
          </>
        )}
        {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
      </View>
    </Dialog>
  );
}
