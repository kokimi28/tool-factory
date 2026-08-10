/**
 * 結果のテキスト化（E12・2巡目）。年金の繰上げ・繰下げシナリオを人が読める1ブロックに整形する純関数。
 */
import type { PensionScenario, BreakEven } from "./calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

/**
 * 年金シナリオと損益分岐を共有用テキストにする。
 * @param scenario pensionScenario の結果
 * @param breakEven breakEvenAgeVs65 の結果（65歳受給との損益分岐）
 */
export function resultToClipboardText(
  scenario: PensionScenario,
  breakEven: BreakEven,
): string {
  const be =
    breakEven.years !== null
      ? `${breakEven.years}歳${breakEven.months}か月`
      : "65歳受給が基準";
  const lines = [
    "【年金 繰上げ・繰下げ シミュレーション】",
    `受給開始年齢: ${scenario.startAge}歳`,
    `受給率: ${pct(scenario.rate)}`,
    `年金月額: ${yen(scenario.monthly)}`,
    `年金年額: ${yen(scenario.annual)}`,
    `65歳受給との損益分岐: ${be}`,
    "※概算・参考値",
  ];
  return lines.join("\n");
}
