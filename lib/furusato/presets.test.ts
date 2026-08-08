/**
 * ふるさと納税 年収プリセットの妥当性テスト（E2）。
 */
import { describe, it, expect } from "vitest";
import { FURUSATO_INCOME_PRESETS } from "./presets";
import { estimateFurusatoLimitFromSalary } from "./calculations";

describe("E2 furusato 年収プリセット", () => {
  it("2件以上・ラベル非空・正の整数・昇順", () => {
    expect(FURUSATO_INCOME_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < FURUSATO_INCOME_PRESETS.length; i++) {
      const p = FURUSATO_INCOME_PRESETS[i];
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.value)).toBe(true);
      expect(p.value).toBeGreaterThan(0);
      if (i > 0) expect(p.value).toBeGreaterThan(FURUSATO_INCOME_PRESETS[i - 1].value);
    }
  });

  it("各プリセットで限度額が正の値になる", () => {
    for (const p of FURUSATO_INCOME_PRESETS) {
      const r = estimateFurusatoLimitFromSalary({
        annualIncome: p.value,
        hasSpouse: false,
        dependents: 0,
      });
      expect(r.limit).toBeGreaterThan(0);
    }
  });
});
