/**
 * 手取りから必要年収の逆算（D10・2巡目）。
 *
 * calculateNetSalary の手取りは年収について単調非減少なので、二分探索で
 * 「その手取り以上になる最小の額面年収」を求める。累進課税により手取りは
 * 年収に正比例しないため、固定倍率では逆算できない（記事 tedori-kara-nenshu-gyakusan の主張）。
 * 本関数はその逆算を calc と同一ロジックで厳密化する。
 */
import { calculateNetSalary } from "./calculations";

/**
 * 目標手取り（年額）以上になる最小の額面年収（円）を返す。
 * @param targetNet 目標の手取り年額（円）
 * @param isOver40 介護保険（40歳以上）
 */
export function grossFromNet(targetNet: number, isOver40 = false): number {
  const target = Math.max(0, Math.floor(targetNet));
  if (target === 0) return 0;

  const takeHome = (income: number) =>
    calculateNetSalary({ annualIncome: income, isOver40 }).takeHome;

  // 上限を目標に届くまで拡張（手取り<年収なので必ず有限で届く）。
  let hi = 10_000_000;
  while (takeHome(hi) < target) hi *= 2;

  let lo = 0;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (takeHome(mid) >= target) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
