/** True when the doctor's specialty is a children's one (Practice `isPediatricSpecialty`). Display only, never a gate on data. */
export function isPediatricSpecialty(specialization: string | null | undefined): boolean {
  return /p(a)?ediatric|neonat|child/i.test(specialization ?? "");
}
