/**
 * E4 nenkin-kuriage 計算の内訳の妥当性テスト。
 * Calculator の「受給率の内訳（詳しく）」が表示する中間値（65歳からの月数・適用率・受給率・月額）が
 * calc の純関数と一致することを worked example で固定する（表示値＝calc 値の保証）。
 */
import { describe, it, expect } from "vitest";
import {
  monthsFrom65,
  ratePerMonth,
  pensionRate,
  monthlyPension,
} from "./calculations";

describe("E4 nenkin-kuriage 受給率の内訳", () => {
  it("65歳からの月数: 70歳=+60・60歳=−60・65歳=0", () => {
    expect(monthsFrom65(70)).toBe(60);
    expect(monthsFrom65(60)).toBe(-60);
    expect(monthsFrom65(65)).toBe(0);
  });

  it("適用率: 繰上げ 0.4%／繰下げ 0.7%", () => {
    expect(ratePerMonth(60)).toBeCloseTo(0.004, 10);
    expect(ratePerMonth(70)).toBeCloseTo(0.007, 10);
  });

  it("受給率 = 1 + 月数 × 適用率（worked example）", () => {
    expect(pensionRate(70)).toBeCloseTo(1.42, 10); // 1 + 60×0.007
    expect(pensionRate(60)).toBeCloseTo(0.76, 10); // 1 − 60×0.004
  });

  it("内訳の合成が calc の月額と一致（表示値＝calc 値）", () => {
    const base = 150_000;
    for (const age of [60, 65, 70, 75]) {
      const rate = 1 + monthsFrom65(age) * ratePerMonth(age);
      expect(rate).toBeCloseTo(pensionRate(age), 10);
      expect(Math.floor(base * rate)).toBe(monthlyPension(base, age));
    }
  });
});
