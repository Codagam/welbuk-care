/** Static Metro require map for assets/teeth PNGs. */
import type { ImageSourcePropType } from "react-native";

export type ToothImageVariant = "default" | "checked" | "treated" | "missing" | "problem";

const TOOTH_IMAGES: Record<string, Partial<Record<ToothImageVariant, ImageSourcePropType>>> = {
  "11": {
    default: require("@/assets/teeth/tooth-11.png"),
    checked: require("@/assets/teeth/tooth-11-checked.png"),
    treated: require("@/assets/teeth/tooth-11-treated.png"),
  },
  "12": {
    default: require("@/assets/teeth/tooth-12.png"),
    checked: require("@/assets/teeth/tooth-12-checked.png"),
    treated: require("@/assets/teeth/tooth-12-treated.png"),
  },
  "13": {
    default: require("@/assets/teeth/tooth-13.png"),
    checked: require("@/assets/teeth/tooth-13-checked.png"),
    treated: require("@/assets/teeth/tooth-13-treated.png"),
  },
  "14": {
    default: require("@/assets/teeth/tooth-14.png"),
    checked: require("@/assets/teeth/tooth-14-checked.png"),
    treated: require("@/assets/teeth/tooth-14-treated.png"),
  },
  "15": {
    default: require("@/assets/teeth/tooth-15.png"),
    checked: require("@/assets/teeth/tooth-15-checked.png"),
    treated: require("@/assets/teeth/tooth-15-treated.png"),
  },
  "16": {
    default: require("@/assets/teeth/tooth-16.png"),
    checked: require("@/assets/teeth/tooth-16-checked.png"),
    treated: require("@/assets/teeth/tooth-16-treated.png"),
  },
  "17": {
    default: require("@/assets/teeth/tooth-17.png"),
    checked: require("@/assets/teeth/tooth-17-checked.png"),
    treated: require("@/assets/teeth/tooth-17-treated.png"),
  },
  "18": {
    default: require("@/assets/teeth/tooth-18.png"),
    checked: require("@/assets/teeth/tooth-18-checked.png"),
    treated: require("@/assets/teeth/tooth-18-treated.png"),
  },
  "21": {
    default: require("@/assets/teeth/tooth-21.png"),
    checked: require("@/assets/teeth/tooth-21-checked.png"),
    treated: require("@/assets/teeth/tooth-21-treated.png"),
  },
  "22": {
    default: require("@/assets/teeth/tooth-22.png"),
    checked: require("@/assets/teeth/tooth-22-checked.png"),
    treated: require("@/assets/teeth/tooth-22-treated.png"),
  },
  "23": {
    default: require("@/assets/teeth/tooth-23.png"),
    checked: require("@/assets/teeth/tooth-23-checked.png"),
    treated: require("@/assets/teeth/tooth-23-treated.png"),
  },
  "24": {
    default: require("@/assets/teeth/tooth-24.png"),
    checked: require("@/assets/teeth/tooth-24-checked.png"),
    treated: require("@/assets/teeth/tooth-24-treated.png"),
  },
  "25": {
    default: require("@/assets/teeth/tooth-25.png"),
    checked: require("@/assets/teeth/tooth-25-checked.png"),
    treated: require("@/assets/teeth/tooth-25-treated.png"),
  },
  "26": {
    default: require("@/assets/teeth/tooth-26.png"),
    checked: require("@/assets/teeth/tooth-26-checked.png"),
    treated: require("@/assets/teeth/tooth-26-treated.png"),
  },
  "27": {
    default: require("@/assets/teeth/tooth-27.png"),
    checked: require("@/assets/teeth/tooth-27-checked.png"),
    treated: require("@/assets/teeth/tooth-27-treated.png"),
  },
  "28": {
    default: require("@/assets/teeth/tooth-28.png"),
    checked: require("@/assets/teeth/tooth-28-checked.png"),
    treated: require("@/assets/teeth/tooth-28-treated.png"),
    problem: require("@/assets/teeth/tooth-28-problem.png"),
  },
  "31": {
    default: require("@/assets/teeth/tooth-31.png"),
    checked: require("@/assets/teeth/tooth-31-checked.png"),
    treated: require("@/assets/teeth/tooth-31-treated.png"),
  },
  "32": {
    default: require("@/assets/teeth/tooth-32.png"),
    checked: require("@/assets/teeth/tooth-32-checked.png"),
    treated: require("@/assets/teeth/tooth-32-treated.png"),
  },
  "33": {
    default: require("@/assets/teeth/tooth-33.png"),
    checked: require("@/assets/teeth/tooth-33-checked.png"),
    treated: require("@/assets/teeth/tooth-33-treated.png"),
  },
  "34": {
    default: require("@/assets/teeth/tooth-34.png"),
    checked: require("@/assets/teeth/tooth-34-checked.png"),
    treated: require("@/assets/teeth/tooth-34-treated.png"),
  },
  "35": {
    default: require("@/assets/teeth/tooth-35.png"),
    checked: require("@/assets/teeth/tooth-35-checked.png"),
    treated: require("@/assets/teeth/tooth-35-treated.png"),
  },
  "36": {
    default: require("@/assets/teeth/tooth-36.png"),
    checked: require("@/assets/teeth/tooth-36-checked.png"),
    treated: require("@/assets/teeth/tooth-36-treated.png"),
    missing: require("@/assets/teeth/tooth-36-missing.png"),
    problem: require("@/assets/teeth/tooth-36-problem.png"),
  },
  "37": {
    default: require("@/assets/teeth/tooth-37.png"),
    checked: require("@/assets/teeth/tooth-37-checked.png"),
    treated: require("@/assets/teeth/tooth-37-treated.png"),
  },
  "38": {
    default: require("@/assets/teeth/tooth-38.png"),
    checked: require("@/assets/teeth/tooth-38-checked.png"),
    treated: require("@/assets/teeth/tooth-38-treated.png"),
    missing: require("@/assets/teeth/tooth-38-missing.png"),
  },
  "41": {
    default: require("@/assets/teeth/tooth-41.png"),
    checked: require("@/assets/teeth/tooth-41-checked.png"),
    treated: require("@/assets/teeth/tooth-41-treated.png"),
  },
  "42": {
    default: require("@/assets/teeth/tooth-42.png"),
    checked: require("@/assets/teeth/tooth-42-checked.png"),
    treated: require("@/assets/teeth/tooth-42-treated.png"),
  },
  "43": {
    default: require("@/assets/teeth/tooth-43.png"),
    checked: require("@/assets/teeth/tooth-43-checked.png"),
    treated: require("@/assets/teeth/tooth-43-treated.png"),
  },
  "44": {
    default: require("@/assets/teeth/tooth-44.png"),
    checked: require("@/assets/teeth/tooth-44-checked.png"),
    treated: require("@/assets/teeth/tooth-44-treated.png"),
  },
  "45": {
    default: require("@/assets/teeth/tooth-45.png"),
    checked: require("@/assets/teeth/tooth-45-checked.png"),
    treated: require("@/assets/teeth/tooth-45-treated.png"),
  },
  "46": {
    default: require("@/assets/teeth/tooth-46.png"),
    checked: require("@/assets/teeth/tooth-46-checked.png"),
    treated: require("@/assets/teeth/tooth-46-treated.png"),
  },
  "47": {
    default: require("@/assets/teeth/tooth-47.png"),
    checked: require("@/assets/teeth/tooth-47-checked.png"),
    treated: require("@/assets/teeth/tooth-47-treated.png"),
  },
  "48": {
    default: require("@/assets/teeth/tooth-48.png"),
    checked: require("@/assets/teeth/tooth-48-checked.png"),
    treated: require("@/assets/teeth/tooth-48-treated.png"),
  },
  "51": {
    default: require("@/assets/teeth/tooth-51.png"),
    checked: require("@/assets/teeth/tooth-51-checked.png"),
    treated: require("@/assets/teeth/tooth-51-treated.png"),
  },
  "52": {
    default: require("@/assets/teeth/tooth-52.png"),
    checked: require("@/assets/teeth/tooth-52-checked.png"),
    treated: require("@/assets/teeth/tooth-52-treated.png"),
  },
  "53": {
    default: require("@/assets/teeth/tooth-53.png"),
    checked: require("@/assets/teeth/tooth-53-checked.png"),
    treated: require("@/assets/teeth/tooth-53-treated.png"),
  },
  "54": {
    default: require("@/assets/teeth/tooth-54.png"),
    checked: require("@/assets/teeth/tooth-54-checked.png"),
    treated: require("@/assets/teeth/tooth-54-treated.png"),
  },
  "55": {
    default: require("@/assets/teeth/tooth-55.png"),
    checked: require("@/assets/teeth/tooth-55-checked.png"),
    treated: require("@/assets/teeth/tooth-55-treated.png"),
  },
  "61": {
    default: require("@/assets/teeth/tooth-61.png"),
    checked: require("@/assets/teeth/tooth-61-checked.png"),
    treated: require("@/assets/teeth/tooth-61-treated.png"),
  },
  "62": {
    default: require("@/assets/teeth/tooth-62.png"),
    checked: require("@/assets/teeth/tooth-62-checked.png"),
    treated: require("@/assets/teeth/tooth-62-treated.png"),
  },
  "63": {
    default: require("@/assets/teeth/tooth-63.png"),
    checked: require("@/assets/teeth/tooth-63-checked.png"),
    treated: require("@/assets/teeth/tooth-63-treated.png"),
  },
  "64": {
    default: require("@/assets/teeth/tooth-64.png"),
    checked: require("@/assets/teeth/tooth-64-checked.png"),
    treated: require("@/assets/teeth/tooth-64-treated.png"),
  },
  "65": {
    default: require("@/assets/teeth/tooth-65.png"),
    checked: require("@/assets/teeth/tooth-65-checked.png"),
    treated: require("@/assets/teeth/tooth-65-treated.png"),
  },
  "71": {
    default: require("@/assets/teeth/tooth-71.png"),
    checked: require("@/assets/teeth/tooth-71-checked.png"),
    treated: require("@/assets/teeth/tooth-71-treated.png"),
  },
  "72": {
    default: require("@/assets/teeth/tooth-72.png"),
    checked: require("@/assets/teeth/tooth-72-checked.png"),
    treated: require("@/assets/teeth/tooth-72-treated.png"),
  },
  "73": {
    default: require("@/assets/teeth/tooth-73.png"),
    checked: require("@/assets/teeth/tooth-73-checked.png"),
    treated: require("@/assets/teeth/tooth-73-treated.png"),
    missing: require("@/assets/teeth/tooth-73-missing.png"),
  },
  "74": {
    default: require("@/assets/teeth/tooth-74.png"),
    checked: require("@/assets/teeth/tooth-74-checked.png"),
    treated: require("@/assets/teeth/tooth-74-treated.png"),
  },
  "75": {
    default: require("@/assets/teeth/tooth-75.png"),
    checked: require("@/assets/teeth/tooth-75-checked.png"),
    treated: require("@/assets/teeth/tooth-75-treated.png"),
  },
  "81": {
    default: require("@/assets/teeth/tooth-81.png"),
    checked: require("@/assets/teeth/tooth-81-checked.png"),
    treated: require("@/assets/teeth/tooth-81-treated.png"),
  },
  "82": {
    default: require("@/assets/teeth/tooth-82.png"),
    checked: require("@/assets/teeth/tooth-82-checked.png"),
    treated: require("@/assets/teeth/tooth-82-treated.png"),
  },
  "83": {
    default: require("@/assets/teeth/tooth-83.png"),
    checked: require("@/assets/teeth/tooth-83-checked.png"),
    treated: require("@/assets/teeth/tooth-83-treated.png"),
  },
  "84": {
    default: require("@/assets/teeth/tooth-84.png"),
    checked: require("@/assets/teeth/tooth-84-checked.png"),
    treated: require("@/assets/teeth/tooth-84-treated.png"),
  },
  "85": {
    default: require("@/assets/teeth/tooth-85.png"),
    checked: require("@/assets/teeth/tooth-85-checked.png"),
    treated: require("@/assets/teeth/tooth-85-treated.png"),
  },
};

const MISSING_IMG = new Set(["36", "38", "73"]);

export function getToothImageSource(fdi: string, variant: ToothImageVariant): ImageSourcePropType | null {
  const entry = TOOTH_IMAGES[fdi];
  if (!entry) return null;
  if (variant === "missing" && !MISSING_IMG.has(fdi)) return entry.default ?? null;
  return entry[variant] ?? entry.default ?? null;
}
