/**
 * 本人の年収プリセット（E2・2巡目）。壁の前後でよくある年収をワンタップで入力する。
 * Calculator とテストで共有し、値の妥当性を CI で固定する。
 */
export type IncomePreset = { label: string; value: number };

export const NENSHU_KABE_PRESETS: IncomePreset[] = [
  { label: "100万", value: 1_000_000 },
  { label: "106万", value: 1_060_000 },
  { label: "120万", value: 1_200_000 },
  { label: "130万", value: 1_300_000 },
  { label: "150万", value: 1_500_000 },
];
