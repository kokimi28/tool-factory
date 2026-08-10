/**
 * 結果のテキスト化（E12・2巡目）。年収の壁ツールの結果を人が読める1ブロックに整形する純関数。
 */
import type { TakeHomeBreakdown, WallReversal, SiWall } from "./calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const man = (n: number) => `${Math.round(n / 10_000).toLocaleString("ja-JP")}万円`;

/**
 * 年収の壁の結果を共有用テキストにする。
 * @param current 現在の年収の手取り内訳
 * @param wall 適用する社会保険の壁（106万 or 130万）
 * @param reversal 壁による手取り逆転の情報
 */
export function resultToClipboardText(
  current: TakeHomeBreakdown,
  wall: SiWall,
  reversal: WallReversal,
): string {
  const lines = [
    "【年収の壁 手取りシミュレーション】",
    `適用する壁: ${man(wall)}の壁`,
    `本人の年収: ${yen(current.income)}`,
    `手取り: ${yen(current.takeHome)}（${current.enrolled ? "社会保険 加入" : "扶養内・未加入"}）`,
    `壁を超えると手取りが約${yen(reversal.dropAtWall)}下がる`,
    `手取りが戻る年収: ${yen(reversal.recoveryIncome)}`,
    "※概算・参考値",
  ];
  return lines.join("\n");
}
