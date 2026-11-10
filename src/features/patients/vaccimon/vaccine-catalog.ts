// Copied verbatim from Practice lib/vaccimon/vaccine-catalog.ts — keep in step; Care never changes Practice.
/**
 * Common childhood and adult vaccines given in India, for picking a vaccine and
 * for matching names read off a vaccination card by OCR.
 *
 * Vaccine names and dose labels are facts, not schedule content: this list says
 * nothing about WHEN a dose is due. The schedule (IAP / UIP) comes later, cited
 * and versioned (docs/VACCIMON_PLAN.md §4).
 *
 * `aliases` include spellings and brand names printed on Indian cards. They exist
 * ONLY to recognise what a card says; the product never shows or ranks a brand to
 * a parent (docs/VACCIMON_PLAN.md §9, and the 2026-10-23 sponsorship research).
 */

export type VaccineCatalogEntry = {
  code: string;
  name: string;
  aliases: string[];
};

export const VACCINE_CATALOG: VaccineCatalogEntry[] = [
  { code: "BCG", name: "BCG", aliases: ["bcg", "bacillus calmette"] },
  { code: "HEPB", name: "Hepatitis B", aliases: ["hep b", "hepb", "hepatitis b", "hbv", "engerix", "genevac b"] },
  { code: "OPV", name: "Oral polio (OPV)", aliases: ["opv", "bopv", "oral polio", "polio drops"] },
  { code: "IPV", name: "Injectable polio (IPV)", aliases: ["ipv", "fipv", "injectable polio", "imovax"] },
  { code: "PENTA", name: "Pentavalent (DTwP-HepB-Hib)", aliases: ["pentavalent", "penta", "dtwp-hepb-hib", "pentavac", "easyfive", "comvac5"] },
  { code: "HEXA", name: "Hexavalent (DTaP-IPV-Hib-HepB)", aliases: ["hexavalent", "hexa", "hexaxim", "infanrix hexa", "dtap-ipv-hib-hepb"] },
  { code: "DTWP", name: "DTwP", aliases: ["dtwp", "dpt", "dtp", "triple antigen"] },
  { code: "DTAP", name: "DTaP", aliases: ["dtap", "acellular dpt", "infanrix", "tripacel"] },
  { code: "HIB", name: "Hib", aliases: ["hib", "haemophilus", "hemophilus"] },
  { code: "ROTA", name: "Rotavirus", aliases: ["rotavirus", "rota", "rotavac", "rotasiil", "rotarix", "rotateq"] },
  { code: "PCV", name: "Pneumococcal conjugate (PCV)", aliases: ["pcv", "pneumococcal", "prevenar", "prevnar", "synflorix", "pneumosil", "vaxneuvance"] },
  { code: "MR", name: "Measles-Rubella (MR)", aliases: ["mr", "measles rubella", "measles-rubella"] },
  { code: "MMR", name: "MMR", aliases: ["mmr", "measles mumps rubella", "tresivac", "priorix"] },
  { code: "JE", name: "Japanese encephalitis (JE)", aliases: ["je", "japanese encephalitis", "jenvac", "ixiaro"] },
  { code: "TCV", name: "Typhoid conjugate (TCV)", aliases: ["typhoid", "tcv", "typbar", "typbar tcv", "zyvac tcv"] },
  { code: "HEPA", name: "Hepatitis A", aliases: ["hep a", "hepa", "hepatitis a", "havrix", "avaxim", "biovac a"] },
  { code: "VARICELLA", name: "Varicella (chickenpox)", aliases: ["varicella", "chickenpox", "chicken pox", "varilrix", "varivax"] },
  { code: "INFLUENZA", name: "Influenza", aliases: ["influenza", "flu", "fluarix", "vaxigrip", "influvac"] },
  { code: "TDAP", name: "Tdap", aliases: ["tdap", "boostrix", "adacel"] },
  { code: "TD", name: "Td", aliases: ["td", "tetanus diphtheria", "tt", "tetanus"] },
  { code: "HPV", name: "HPV", aliases: ["hpv", "human papilloma", "gardasil", "cervarix", "cervavac"] },
  { code: "MENINGO", name: "Meningococcal", aliases: ["meningococcal", "meningo", "menactra", "menveo", "menquadfi"] },
  { code: "CHOLERA", name: "Cholera", aliases: ["cholera", "shanchol"] },
  { code: "RABIES", name: "Rabies", aliases: ["rabies", "rabipur", "verorab"] },
];

export const OTHER_VACCINE_CODE = "OTHER";

const BY_CODE = new Map(VACCINE_CATALOG.map((v) => [v.code, v]));

export function vaccineByCode(code: string | null | undefined): VaccineCatalogEntry | null {
  return code ? (BY_CODE.get(code) ?? null) : null;
}

/** The dose labels offered in the picker. Free text is also accepted. */
export const DOSE_LABELS = [
  "Birth dose",
  "Dose 1",
  "Dose 2",
  "Dose 3",
  "Dose 4",
  "Booster 1",
  "Booster 2",
  "Annual",
] as const;

/** Lower-case, collapse anything that is not a letter or digit to one space. */
export function normaliseVaccineText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The catalogue entry a piece of text names, preferring the LONGEST alias found,
 * so "infanrix hexa" resolves to HEXA rather than "infanrix" → DTaP. Every alias
 * matches whole words only, so "td" does not fire inside "ltd". That is not enough
 * for 2-letter aliases ("mr", "td", "je", "tt"): "Mr. Kumar" is still a whole-word
 * "mr". So a short match is flagged `weak`, and the OCR parser trusts it less.
 */
export function matchVaccine(
  text: string,
): { entry: VaccineCatalogEntry; alias: string; weak: boolean } | null {
  const norm = ` ${normaliseVaccineText(text)} `;
  let best: { entry: VaccineCatalogEntry; alias: string; weak: boolean } | null = null;
  for (const entry of VACCINE_CATALOG) {
    for (const alias of entry.aliases) {
      const a = normaliseVaccineText(alias);
      if (!a) continue;
      if (norm.includes(` ${a} `) && (!best || a.length > best.alias.length)) {
        best = { entry, alias: a, weak: a.length <= 2 };
      }
    }
  }
  return best;
}
