/**
 * E12 結果テキスト化の妥当性テスト。基準ケース（年収400万・40歳未満）の
 * コピー用テキストが calc の数値を正しく含むことを固定する（表示＝calc 値）。
 */
import { describe, it, expect } from "vitest";
import { resultToClipboardText } from "./result-text";
import { calculateNetSalary } from "./calculations";

describe("E12 tedori 結果テキスト化", () => {
  const r = calculateNetSalary({ annualIncome: 4_000_000, isOver40: false });
  const text = resultToClipboardText(r);

  it("見出しと注記を含む", () => {
    expect(text).toContain("【年収の手取り計算】");
    expect(text).toContain("※概算・参考値");
  });

  it("手取り・月額・率・社保・所得税・住民税の calc 値を含む", () => {
    expect(text).toContain("3,166,400円"); // 手取り年額
    expect(text).toContain("263,867円"); // 手取り月額
    expect(text).toContain("79.2%"); // 手取り率
    expect(text).toContain("588,600円"); // 社会保険料
    expect(text).toContain("65,900円"); // 所得税
    expect(text).toContain("179,100円"); // 住民税
  });

  it("行数は8行（見出し＋6項目＋注記）", () => {
    expect(text.split("\n")).toHaveLength(8);
  });
});
