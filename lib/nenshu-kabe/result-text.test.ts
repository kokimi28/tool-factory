/**
 * E12 結果テキスト化の妥当性テスト（nenshu-kabe）。
 * 代表ケース（年収140万・130万の壁）でテキストが calc の数値を含むことを固定する。
 */
import { describe, it, expect } from "vitest";
import { resultToClipboardText } from "./result-text";
import {
  takeHomeWithWall,
  analyzeWallReversal,
  SOCIAL_INSURANCE_WALLS,
} from "./calculations";

describe("E12 nenshu-kabe 結果テキスト化", () => {
  const wall = SOCIAL_INSURANCE_WALLS.standard; // 130万
  const current = takeHomeWithWall(1_400_000, wall);
  const reversal = analyzeWallReversal(wall);
  const text = resultToClipboardText(current, wall, reversal);

  it("見出しと注記を含む", () => {
    expect(text).toContain("【年収の壁 手取りシミュレーション】");
    expect(text).toContain("※概算・参考値");
  });

  it("壁・年収・手取り・加入状況の calc 値を含む", () => {
    expect(text).toContain("130万円の壁");
    expect(text).toContain(`${current.takeHome.toLocaleString("ja-JP")}円`);
    expect(text).toContain(current.enrolled ? "社会保険 加入" : "扶養内・未加入");
  });

  it("逆転額と回復年収を含む", () => {
    expect(text).toContain(`${reversal.dropAtWall.toLocaleString("ja-JP")}円`);
    expect(text).toContain(`${reversal.recoveryIncome.toLocaleString("ja-JP")}円`);
  });

  it("行数は7行（見出し＋5項目＋注記）", () => {
    expect(text.split("\n")).toHaveLength(7);
  });
});
