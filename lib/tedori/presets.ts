/**
 * 年収プリセット（E2・2巡目）。代表的な年収をワンタップで入力するための定数。
 * Calculator とテストで共有する（値の妥当性を CI で固定できる）。
 */
export type TedoriPreset = { label: string; value: number };

export const TEDORI_PRESETS: TedoriPreset[] = [
  { label: "300万", value: 3_000_000 },
  { label: "400万", value: 4_000_000 },
  { label: "500万", value: 5_000_000 },
  { label: "700万", value: 7_000_000 },
  { label: "1000万", value: 10_000_000 },
];
