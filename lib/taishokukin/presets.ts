/**
 * 退職金額プリセット（E2・2巡目）。代表的な退職金額（万円）をワンタップで入力する。
 * Calculator とテストで共有し、値の妥当性を CI で固定する。
 * UI 入力が万円単位のため、値も万円で保持する（円換算は ×10,000）。
 */
export type RetirementPreset = { label: string; man: number };

export const TAISHOKUKIN_PRESETS: RetirementPreset[] = [
  { label: "500万", man: 500 },
  { label: "1000万", man: 1000 },
  { label: "1500万", man: 1500 },
  { label: "2000万", man: 2000 },
  { label: "3000万", man: 3000 },
];
