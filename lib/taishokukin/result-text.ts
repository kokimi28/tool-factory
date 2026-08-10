/**
 * 結果のテキスト化（E12・2巡目）。退職金課税の結果を人が読める1ブロックのテキストに整形する純関数。
 * 「結果をコピー」ボタンがこの文字列をクリップボードに書き込む。
 */
import type { RetirementResult } from "./calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

/**
 * 退職金課税の結果を共有用テキストにする。
 * @param result calcAll の結果
 */
export function resultToClipboardText(result: RetirementResult): string {
  const lines = [
    "【退職金の手取り計算】",
    `勤続年数（切上げ後）: ${result.effectiveYears}年`,
    `退職所得控除: ${yen(result.retirementDeduction)}`,
    `課税退職所得: ${yen(result.taxableRetirementIncome)}`,
    `所得税: ${yen(result.incomeTax)}`,
    `住民税: ${yen(result.residentTax)}`,
    `税額合計: ${yen(result.totalTax)}`,
    `手取り額: ${yen(result.netAmount)}`,
    "※概算・参考値",
  ];
  return lines.join("\n");
}
