/**
 * 結果のテキスト化（E12・2巡目）。計算結果を人が読める1ブロックのテキストに整形する純関数。
 * 「結果をコピー」ボタンがこの文字列をクリップボードに書き込む＝SNS/メモへの持ち出しを1タップに。
 */
import type { NetSalaryResult } from "./calculations";
import { yen } from "./format";

/**
 * 手取り計算の結果を共有用テキストにする。
 * @param result calculateNetSalary の結果
 */
export function resultToClipboardText(result: NetSalaryResult): string {
  const ratePct = (result.takeHomeRate * 100).toFixed(1);
  const lines = [
    "【年収の手取り計算】",
    `手取り（年額）: ${yen(result.takeHome)}`,
    `手取り月額の目安: ${yen(result.takeHomeMonthly)}`,
    `手取り率: ${ratePct}%`,
    `社会保険料: ${yen(result.socialInsurance)}`,
    `所得税: ${yen(result.incomeTax)}`,
    `住民税: ${yen(result.residentTax)}`,
    "※概算・参考値",
  ];
  return lines.join("\n");
}
