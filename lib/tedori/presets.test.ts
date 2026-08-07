/**
 * 年収プリセットの妥当性テスト（E2）。プリセット値で計算が破綻しないことを固定。
 */
import { describe, it, expect } from "vitest";
import { TEDORI_PRESETS } from "./presets";
import { calculateNetSalary } from "./calculations";

describe("E2 tedori プリセット", () => {
  it("プリセットは2件以上・ラベル非空・正の整数", () => {
    expect(TEDORI_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const p of TEDORI_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.value)).toBe(true);
      expect(p.value).toBeGreaterThan(0);
    }
  });

  it("各プリセットで手取りは 0〜額面の範囲に収まる", () => {
    for (const p of TEDORI_PRESETS) {
      const r = calculateNetSalary({ annualIncome: p.value, isOver40: false });
      expect(r.takeHome).toBeGreaterThan(0);
      expect(r.takeHome).toBeLessThanOrEqual(p.value);
    }
  });

  it("プリセット値は昇順（UI の並び）", () => {
    for (let i = 1; i < TEDORI_PRESETS.length; i++) {
      expect(TEDORI_PRESETS[i].value).toBeGreaterThan(TEDORI_PRESETS[i - 1].value);
    }
  });
});
