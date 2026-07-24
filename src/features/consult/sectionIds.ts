/** Matches Practice `SectionNavigator` CONSULT_SECTION_IDS. */
export const CONSULT_SECTION_IDS = {
  consultation: "consult-section-consultation",
  dental: "consult-section-dental",
  eye: "consult-section-eye",
  clinical: "consult-section-clinical",
  recordings: "consult-section-recordings",
  plan: "consult-section-plan",
} as const;

export type ConsultSectionId =
  (typeof CONSULT_SECTION_IDS)[keyof typeof CONSULT_SECTION_IDS];

export type SectionNavItem = {
  id: ConsultSectionId;
  label: string;
};
