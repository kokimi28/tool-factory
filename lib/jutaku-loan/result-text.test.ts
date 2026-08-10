/**
 * E12 結果テキスト化の妥当性テスト（jutaku-loan）。
 * 代表ケース（借入3000万・金利1%・35年・ZEH）でテキストが calc の数値を含むことを固定する。
 */
import { describe, it, expect } from "vitest";
import { resultToClipboardText } from "./result-text";
import { calcHomeLoanDeduction } from "./calculations";

describe("E12 jutaku-loan 結果テキスト化", () => {
  const r = calcHomeLoanDeduction({
    principal: 30_000_000,
    annualRatePercent: 1.0,
    years: 35,
    housingType: "zeh",
    childRearingHousehold: false,
  });
  const text = resultToClipboardText(r);

  it("見出しと注記を含む", () => {
    expect(text).toContain("【住宅ローン控除シミュレーション】");
    expect(text).toContain("※概算・参考値");
  });

  it("控除総額・限度額・毎月返済の calc 値を含む", () => {
    expect(text).toContain(`${r.totalDeduction.toLocaleString("ja-JP")}円`);
    expect(text).toContain(`${r.limit.toLocaleString("ja-JP")}円`);
    expect(text).toContain(`${r.monthlyPayment.toLocaleString("ja-JP")}円`);
    expect(text).toContain(`${r.years}年`);
  });

  it("行数は6行（見出し＋4項目＋注記）", () => {
    expect(text.split("\n")).toHaveLength(6);
  });
});
