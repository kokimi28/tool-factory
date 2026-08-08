/**
 * 年収プリセット（E2・furusato）。ふるさと納税の年収概算モードで代表的な年収を
 * ワンタップ入力するための定数。Calculator とテストで共有する。
 */
export type FurusatoPreset = { label: string; value: number };

export const FURUSATO_INCOME_PRESETS: FurusatoPreset[] = [
  { label: "400万", value: 4_000_000 },
  { label: "500万", value: 5_000_000 },
  { label: "700万", value: 7_000_000 },
  { label: "1000万", value: 10_000_000 },
];
