/**
 * E12 結果テキスト化の妥当性テスト（furusato）。
 * 代表ケース（課税総所得300万）でテキストが calc の数値を含むことを固定する。
 */
import { describe, it, expect } from "vitest";
import { resultToClipboardText } from "./result-text";
import { calcFurusatoLimit } from "./calculations";

describe("E12 furusato 結果テキスト化", () => {
  const taxable = 3_000_000;
  const r = calcFurusatoLimit(taxable);
  const text = resultToClipboardText({ ...r, taxable });

  it("見出しと注記を含む", () => {
    expect(text).toContain("【ふるさと納税 限度額の目安】");
    expect(text).toContain("※概算・参考値");
  });

  it("限度額・課税総所得・住民税所得割の calc 値を含む", () => {
    expect(text).toContain(`${r.limit.toLocaleString("ja-JP")}円`);
    expect(text).toContain("3,000,000円"); // 課税総所得
    expect(text).toContain("300,000円"); // 住民税所得割（課税所得×10%）
  });

  it("行数は6行（見出し＋4項目＋注記）", () => {
    expect(text.split("\n")).toHaveLength(6);
  });
});
