/**
 * E12 結果テキスト化の妥当性テスト（taishokukin）。
 * 代表ケース（退職金2000万・勤続25年・一般）でテキストが calc の数値を含むことを固定する。
 */
import { describe, it, expect } from "vitest";
import { resultToClipboardText } from "./result-text";
import { calcAll } from "./calculations";

describe("E12 taishokukin 結果テキスト化", () => {
  const r = calcAll({
    retirementAmount: 20_000_000,
    yearsOfService: 25,
    monthsOfService: 0,
    isExecutive: false,
    separationReason: "voluntary",
  });
  const text = resultToClipboardText(r);

  it("見出しと注記を含む", () => {
    expect(text).toContain("【退職金の手取り計算】");
    expect(text).toContain("※概算・参考値");
  });

  it("勤続年数・手取り・税額合計の calc 値を含む", () => {
    expect(text).toContain(`${r.effectiveYears}年`);
    expect(text).toContain(`${r.netAmount.toLocaleString("ja-JP")}円`);
    expect(text).toContain(`${r.totalTax.toLocaleString("ja-JP")}円`);
  });

  it("行数は9行（見出し＋7項目＋注記）", () => {
    expect(text.split("\n")).toHaveLength(9);
  });
});
