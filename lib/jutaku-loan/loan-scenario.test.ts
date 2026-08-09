/**
 * E8 借入額スライダー・比較表の妥当性テスト。
 * 代表点が昇順・正であること、金利/期間/住宅種別を固定して借入額を上げたとき
 * 毎月返済額は増加し、控除総額は非減少（限度額で頭打ち）であることを固定する。
 */
import { describe, it, expect } from "vitest";
import { LOAN_PRINCIPAL_POINTS } from "@/components/jutaku-loan/PrincipalScenarioTable";
import { calcHomeLoanDeduction } from "./calculations";

const PARAMS = {
  annualRatePercent: 1.0,
  years: 35,
  housingType: "zeh" as const,
  childRearingHousehold: false,
};

describe("E8 住宅ローン 借入額比較", () => {
  it("代表借入額は3件以上・昇順・正の整数", () => {
    expect(LOAN_PRINCIPAL_POINTS.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < LOAN_PRINCIPAL_POINTS.length; i++) {
      expect(Number.isInteger(LOAN_PRINCIPAL_POINTS[i])).toBe(true);
      expect(LOAN_PRINCIPAL_POINTS[i]).toBeGreaterThan(0);
      if (i > 0) expect(LOAN_PRINCIPAL_POINTS[i]).toBeGreaterThan(LOAN_PRINCIPAL_POINTS[i - 1]);
    }
  });

  it("借入額を上げると毎月返済は増え、控除総額は非減少", () => {
    const rows = LOAN_PRINCIPAL_POINTS.map((principal) =>
      calcHomeLoanDeduction({ principal, ...PARAMS }),
    );
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].monthlyPayment).toBeGreaterThan(rows[i - 1].monthlyPayment);
      expect(rows[i].totalDeduction).toBeGreaterThanOrEqual(rows[i - 1].totalDeduction);
    }
  });
});
