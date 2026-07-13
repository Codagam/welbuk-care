/**
 * FDI odontogram positions — from Practice dentalChartSvg.ts (% of 1:1 chart).
 * Permanent = outer arches; primary = inner.
 */

export type ToothPos = {
  fdi: string;
  x: number;
  y: number;
  lx: number;
  ly: number;
};

const UPPER_PERM: ToothPos[] = [
  { fdi: "18", x: 22, y: 46, lx: 17, ly: 46 },
  { fdi: "17", x: 23.5, y: 38.5, lx: 18, ly: 38.5 },
  { fdi: "16", x: 25, y: 31.5, lx: 19, ly: 29.5 },
  { fdi: "15", x: 27.5, y: 25, lx: 22, ly: 23.5 },
  { fdi: "14", x: 31, y: 19.5, lx: 26.5, ly: 16 },
  { fdi: "13", x: 35.5, y: 14.5, lx: 31, ly: 11 },
  { fdi: "12", x: 40.5, y: 11, lx: 38, ly: 7 },
  { fdi: "11", x: 46, y: 9, lx: 46, ly: 4 },
  { fdi: "21", x: 54, y: 9, lx: 54, ly: 4 },
  { fdi: "22", x: 59.5, y: 11, lx: 62, ly: 7 },
  { fdi: "23", x: 64.5, y: 14.5, lx: 69, ly: 11 },
  { fdi: "24", x: 69, y: 19.5, lx: 73.5, ly: 16 },
  { fdi: "25", x: 72.5, y: 25, lx: 77.5, ly: 22.5 },
  { fdi: "26", x: 75, y: 31.5, lx: 80, ly: 31.5 },
  { fdi: "27", x: 76.5, y: 38.5, lx: 81.5, ly: 38.5 },
  { fdi: "28", x: 78, y: 46, lx: 83, ly: 46 },
];

const UPPER_PRIMARY: ToothPos[] = [
  { fdi: "55", x: 33, y: 41.5, lx: 37, ly: 41.5 },
  { fdi: "54", x: 34.5, y: 35.5, lx: 38, ly: 36 },
  { fdi: "53", x: 36, y: 30, lx: 39, ly: 32.5 },
  { fdi: "52", x: 39.5, y: 24.5, lx: 41, ly: 28.5 },
  { fdi: "51", x: 45, y: 21, lx: 46, ly: 25 },
  { fdi: "61", x: 55, y: 21, lx: 54, ly: 25 },
  { fdi: "62", x: 60.5, y: 24.5, lx: 60, ly: 28.5 },
  { fdi: "63", x: 64, y: 30, lx: 62, ly: 32.5 },
  { fdi: "64", x: 65.5, y: 35.5, lx: 62, ly: 36 },
  { fdi: "65", x: 67, y: 41.5, lx: 63, ly: 41.5 },
];

const LOWER_PRIMARY: ToothPos[] = [
  { fdi: "85", x: 33, y: 58.5, lx: 37, ly: 58.5 },
  { fdi: "84", x: 34.5, y: 64.5, lx: 39, ly: 64.5 },
  { fdi: "83", x: 36, y: 70, lx: 40, ly: 68 },
  { fdi: "82", x: 39.5, y: 75.5, lx: 42, ly: 71.5 },
  { fdi: "81", x: 45, y: 79, lx: 46, ly: 75 },
  { fdi: "71", x: 55, y: 79, lx: 54, ly: 75 },
  { fdi: "72", x: 60.5, y: 75.5, lx: 57, ly: 72.5 },
  { fdi: "73", x: 64, y: 70, lx: 60, ly: 68 },
  { fdi: "74", x: 65.5, y: 64.5, lx: 62, ly: 64 },
  { fdi: "75", x: 67, y: 58.5, lx: 63, ly: 58.5 },
];

const LOWER_PERM: ToothPos[] = [
  { fdi: "48", x: 22, y: 54, lx: 17, ly: 54 },
  { fdi: "47", x: 23.5, y: 61.5, lx: 18, ly: 61.5 },
  { fdi: "46", x: 25, y: 68.5, lx: 19, ly: 69.5 },
  { fdi: "45", x: 27.5, y: 75, lx: 23, ly: 79 },
  { fdi: "44", x: 31, y: 80.5, lx: 26.5, ly: 84 },
  { fdi: "43", x: 35.5, y: 85.5, lx: 31, ly: 89 },
  { fdi: "42", x: 40.5, y: 89, lx: 38, ly: 93 },
  { fdi: "41", x: 46, y: 91, lx: 46, ly: 96 },
  { fdi: "31", x: 54, y: 91, lx: 54, ly: 96 },
  { fdi: "32", x: 59.5, y: 89, lx: 62, ly: 93 },
  { fdi: "33", x: 64.5, y: 85.5, lx: 69, ly: 89 },
  { fdi: "34", x: 69, y: 80.5, lx: 73.5, ly: 84 },
  { fdi: "35", x: 72.5, y: 75, lx: 77.5, ly: 75 },
  { fdi: "36", x: 75, y: 68.5, lx: 80, ly: 68.5 },
  { fdi: "37", x: 76.5, y: 61.5, lx: 81.5, ly: 61.5 },
  { fdi: "38", x: 78, y: 54, lx: 83, ly: 54 },
];

export const ALL_CHART_TEETH: ToothPos[] = [
  ...UPPER_PERM,
  ...UPPER_PRIMARY,
  ...LOWER_PRIMARY,
  ...LOWER_PERM,
];

export const TOOTH_SCALE_PERM = 5.5;
export const TOOTH_SCALE_PRIMARY = 4.5;

export function isDeciduousFdi(fdi: string): boolean {
  const q = Math.floor(parseInt(fdi, 10) / 10);
  return q >= 5 && q <= 8;
}
