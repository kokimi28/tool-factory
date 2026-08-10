/**
 * 結果のテキスト化（E12・2巡目）。iDeCo・退職金の受取税シミュレーション結果を
 * 人が読める1ブロックに整形する純関数。
 */
import type { IdecoSimResult } from "./calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

/**
 * iDeCo受取税の結果を共有用テキストにする。
 * @param result calcIdecoSim の結果
 */
export function resultToClipboardText(result: IdecoSimResult): string {
  const lines = [
    "【iDeCo・退職金の受取税シミュレーション】",
    `適用ルール: ${result.appliedRule}`,
    `収入合計: ${yen(result.totalIncome)}`,
    `税額合計（所得税＋住民税）: ${yen(result.totalTax)}`,
    `手取り合計: ${yen(result.totalNet)}`,
    "※概算・参考値",
  ];
  return lines.join("\n");
}
