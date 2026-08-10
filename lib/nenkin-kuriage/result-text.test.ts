/**
 * E12 結果テキスト化の妥当性テスト（nenkin-kuriage）。
 * 代表ケース（基準月額15万・70歳受給）でテキストが calc の数値を含むことを固定する。
 */
import { describe, it, expect } from "vitest";
import { resultToClipboardText } from "./result-text";
import { pensionScenario, breakEvenAgeVs65 } from "./calculations";

describe("E12 nenkin-kuriage 結果テキスト化", () => {
  const scenario = pensionScenario(150_000, 70);
  const be = breakEvenAgeVs65(70);
  const text = resultToClipboardText(scenario, be);

  it("見出しと注記を含む", () => {
    expect(text).toContain("【年金 繰上げ・繰下げ シミュレーション】");
    expect(text).toContain("※概算・参考値");
  });

  it("受給開始年齢・受給率・月額の calc 値を含む", () => {
    expect(text).toContain("70歳");
    expect(text).toContain("142.0%"); // 70歳の受給率
    expect(text).toContain(`${scenario.monthly.toLocaleString("ja-JP")}円`);
  });

  it("損益分岐（65歳受給との）を含む", () => {
    expect(text).toContain(`${be.years}歳${be.months}か月`);
  });

  it("行数は7行（見出し＋5項目＋注記）", () => {
    expect(text.split("\n")).toHaveLength(7);
  });
});
