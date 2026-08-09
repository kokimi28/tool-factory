/**
 * 借入額プリセット（E2・2巡目）。よくある住宅ローン借入額をワンタップで入力する。
 * Calculator とテストで共有し、値の妥当性を CI で固定する。
 */
export type PrincipalPreset = { label: string; value: number };

export const JUTAKU_LOAN_PRESETS: PrincipalPreset[] = [
  { label: "2500万", value: 25_000_000 },
  { label: "3000万", value: 30_000_000 },
  { label: "3500万", value: 35_000_000 },
  { label: "4000万", value: 40_000_000 },
  { label: "5000万", value: 50_000_000 },
];
