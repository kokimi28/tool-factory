/**
 * 借入額プリセットの妥当性テスト（E2）。プリセット値で控除計算が破綻しないことを固定。
 */
import { describe, it, expect } from "vitest";
import { JUTAKU_LOAN_PRESETS } from "./presets";
import { calcHomeLoanDeduction } from "./calculations";

describe("E2 jutaku-loan 借入額プリセット", () => {
  it("プリセットは2件以上・ラベル非空・正の整数", () => {
    expect(JUTAKU_LOAN_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const p of JUTAKU_LOAN_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.value)).toBe(true);
      expect(p.value).toBeGreaterThan(0);
    }
  });

  it("プリセット値は昇順（UI の並び）", () => {
    for (let i = 1; i < JUTAKU_LOAN_PRESETS.length; i++) {
      expect(JUTAKU_LOAN_PRESETS[i].value).toBeGreaterThan(JUTAKU_LOAN_PRESETS[i - 1].value);
    }
  });

  it("各プリセットで毎月返済・控除総額は正（金利1%・35年・ZEH）", () => {
    for (const p of JUTAKU_LOAN_PRESETS) {
      const r = calcHomeLoanDeduction({
        principal: p.value,
        annualRatePercent: 1.0,
        years: 35,
        housingType: "zeh",
        childRearingHousehold: false,
      });
      expect(r.monthlyPayment).toBeGreaterThan(0);
      expect(r.totalDeduction).toBeGreaterThan(0);
    }
  });
});
