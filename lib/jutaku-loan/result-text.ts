/**
 * 結果のテキスト化（E12・2巡目）。住宅ローン控除の結果を人が読める1ブロックに整形する純関数。
 */
import type { HomeLoanResult } from "./calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

/**
 * 住宅ローン控除の結果を共有用テキストにする。
 * @param result calcHomeLoanDeduction の結果
 */
export function resultToClipboardText(result: HomeLoanResult): string {
  const lines = [
    "【住宅ローン控除シミュレーション】",
    `控除見込み総額（${result.years}年間）: ${yen(result.totalDeduction)}`,
    `借入限度額: ${yen(result.limit)}`,
    `控除期間: ${result.years}年`,
    `毎月返済額: ${yen(result.monthlyPayment)}`,
    "※概算・参考値",
  ];
  return lines.join("\n");
}
