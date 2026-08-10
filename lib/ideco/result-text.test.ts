/**
 * E12 結果テキスト化の妥当性テスト（ideco）。
 * 代表シナリオ（同年合算）でテキストが calc の数値・適用ルールを含むことを固定する。
 */
import { describe, it, expect } from "vitest";
import { resultToClipboardText } from "./result-text";
import { calcIdecoSim, type IdecoSimInput } from "./calculations";

describe("E12 ideco 結果テキスト化", () => {
  const input: IdecoSimInput = {
    taishokukin: { amount: 20_000_000, years: 30 },
    ideco: { amount: 5_000_000, years: 15 },
    order: "same_year",
    gapYears: 0,
    overlapYears: 15,
    laterReceiptYear: 2025,
  };
  const r = calcIdecoSim(input);
  const text = resultToClipboardText(r);

  it("見出しと注記を含む", () => {
    expect(text).toContain("【iDeCo・退職金の受取税シミュレーション】");
    expect(text).toContain("※概算・参考値");
  });

  it("適用ルール・収入合計・手取り合計の calc 値を含む", () => {
    expect(text).toContain(r.appliedRule);
    expect(text).toContain(`${r.totalIncome.toLocaleString("ja-JP")}円`);
    expect(text).toContain(`${r.totalNet.toLocaleString("ja-JP")}円`);
  });

  it("行数は6行（見出し＋4項目＋注記）", () => {
    expect(text.split("\n")).toHaveLength(6);
  });
});
