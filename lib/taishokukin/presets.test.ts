/**
 * 退職金額プリセットの妥当性テスト（E2）。プリセット値で計算が破綻しないことを固定。
 */
import { describe, it, expect } from "vitest";
import { TAISHOKUKIN_PRESETS } from "./presets";
import { calcAll } from "./calculations";

describe("E2 taishokukin 退職金額プリセット", () => {
  it("プリセットは2件以上・ラベル非空・正の整数（万円）", () => {
    expect(TAISHOKUKIN_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const p of TAISHOKUKIN_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.man)).toBe(true);
      expect(p.man).toBeGreaterThan(0);
    }
  });

  it("プリセット値は昇順（UI の並び）", () => {
    for (let i = 1; i < TAISHOKUKIN_PRESETS.length; i++) {
      expect(TAISHOKUKIN_PRESETS[i].man).toBeGreaterThan(TAISHOKUKIN_PRESETS[i - 1].man);
    }
  });

  it("各プリセットで手取りは 0〜退職金額の範囲・税額は非負（勤続25年・一般）", () => {
    for (const p of TAISHOKUKIN_PRESETS) {
      const amount = p.man * 10_000;
      const r = calcAll({
        retirementAmount: amount,
        yearsOfService: 25,
        monthsOfService: 0,
        isExecutive: false,
        separationReason: "voluntary",
      });
      expect(r.totalTax).toBeGreaterThanOrEqual(0);
      expect(r.netAmount).toBeGreaterThan(0);
      expect(r.netAmount).toBeLessThanOrEqual(amount);
    }
  });
});
