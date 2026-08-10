/**
 * 結果のテキスト化（E12・2巡目）。ふるさと納税の限度額結果を人が読める1ブロックに整形する純関数。
 */
import type { FurusatoResult } from "./calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * ふるさと納税の限度額結果を共有用テキストにする。
 * @param result FurusatoResult に課税総所得（taxable）を加えたもの
 */
export function resultToClipboardText(
  result: FurusatoResult & { taxable: number },
): string {
  const lines = [
    "【ふるさと納税 限度額の目安】",
    `控除上限（自己負担2,000円）: ${yen(result.limit)}`,
    `課税総所得金額: ${yen(result.taxable)}`,
    `住民税所得割: ${yen(result.residentLevy)}`,
    `所得税の限界税率: ${pct(result.marginalRate)}`,
    "※概算・参考値",
  ];
  return lines.join("\n");
}
