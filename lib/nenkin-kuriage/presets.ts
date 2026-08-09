/**
 * 65歳時点の年金月額プリセット（E2・2巡目）。代表的な月額をワンタップで入力する。
 * Calculator とテストで共有し、値の妥当性を CI で固定する。
 * 目安: 国民年金満額のみ〜厚生年金の平均的な受給月額の帯（概算）。
 */
export type PensionPreset = { label: string; value: number };

export const PENSION_MONTHLY_PRESETS: PensionPreset[] = [
  { label: "6.8万（国民年金満額）", value: 68_000 },
  { label: "10万", value: 100_000 },
  { label: "13万", value: 130_000 },
  { label: "15万", value: 150_000 },
  { label: "18万", value: 180_000 },
];
