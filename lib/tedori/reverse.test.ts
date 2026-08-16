/**
 * D10 手取りから必要年収の逆算テスト。
 * calc と同一ロジックの二分探索が「目標手取り以上になる最小年収」を返すことを、
 * worked example と不変条件（単調性・最小性・手取り達成）で固定する（§品質ゲート①）。
 */
import { describe, it, expect } from "vitest";
import { grossFromNet } from "./reverse";
import { calculateNetSalary } from "./calculations";

const th = (income: number) =>
  calculateNetSalary({ annualIncome: income, isOver40: false }).takeHome;

describe("D10 grossFromNet 手取り→必要年収", () => {
  it("目標0は年収0", () => {
    expect(grossFromNet(0)).toBe(0);
    expect(grossFromNet(-100)).toBe(0);
  });

  it("worked example（40歳未満）", () => {
    expect(grossFromNet(3_000_000)).toBe(3_779_391);
    expect(grossFromNet(4_000_000)).toBe(5_138_000);
    expect(grossFromNet(5_000_000)).toBe(6_524_997);
  });

  it("返す年収は目標手取り以上を満たす最小値（最小性）", () => {
    for (const target of [2_500_000, 3_000_000, 4_500_000, 6_000_000]) {
      const g = grossFromNet(target);
      expect(th(g)).toBeGreaterThanOrEqual(target);
      expect(th(g - 1)).toBeLessThan(target); // これ未満だと目標に届かない
    }
  });

  it("目標が大きいほど必要年収も大きい（単調性）", () => {
    const targets = [2_000_000, 3_000_000, 4_000_000, 5_000_000, 7_000_000];
    for (let i = 1; i < targets.length; i++) {
      expect(grossFromNet(targets[i])).toBeGreaterThan(grossFromNet(targets[i - 1]));
    }
  });
});
