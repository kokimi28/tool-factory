/**
 * 受取シナリオ・プリセットの妥当性テスト（E2）。
 * 各プリセットが Calculator の validate() が要求する不変条件
 * （西暦の範囲・退職年≥入社年・受給年≥加入開始年・金額≥0）を満たすことを固定し、
 * プリセット適用でフォームが必ず有効な状態になる（＝計算が走る）ことを保証する。
 */
import { describe, it, expect } from "vitest";
import { IDECO_PRESETS, type IdecoPresetInputs } from "./presets";

const YEAR_MIN = 1950;
const YEAR_MAX = 2100;

const toInt = (s: string): number => Number(s);
const inYearRange = (n: number) => Number.isInteger(n) && n >= YEAR_MIN && n <= YEAR_MAX;

function assertValid(inputs: IdecoPresetInputs) {
  const nyusha = toInt(inputs.nyushaYear);
  const taishoku = toInt(inputs.taishokuYear);
  const idecoStart = toInt(inputs.idecoStartYear);
  const idecoReceipt = toInt(inputs.idecoReceiptYear);
  const taishokuMan = Number(inputs.taishokuMan);
  const idecoMan = Number(inputs.idecoMan);

  expect(inYearRange(nyusha)).toBe(true);
  expect(inYearRange(taishoku)).toBe(true);
  expect(inYearRange(idecoStart)).toBe(true);
  expect(inYearRange(idecoReceipt)).toBe(true);
  expect(taishoku).toBeGreaterThanOrEqual(nyusha);
  expect(idecoReceipt).toBeGreaterThanOrEqual(idecoStart);
  expect(taishokuMan).toBeGreaterThanOrEqual(0);
  expect(idecoMan).toBeGreaterThanOrEqual(0);
}

describe("E2 ideco 受取シナリオ・プリセット", () => {
  it("プリセットは2件以上・ラベル/説明は非空", () => {
    expect(IDECO_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const p of IDECO_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("各プリセットは validate() の不変条件を満たす（適用でフォームが有効）", () => {
    for (const p of IDECO_PRESETS) {
      assertValid(p.inputs);
    }
  });

  it("受取順序のバリエーションを網羅する（先・後・同年）", () => {
    const orders = IDECO_PRESETS.map((p) => {
      const t = toInt(p.inputs.taishokuYear);
      const r = toInt(p.inputs.idecoReceiptYear);
      return t < r ? "taishoku_first" : t > r ? "ideco_first" : "same_year";
    });
    expect(orders).toContain("taishoku_first");
    expect(orders).toContain("ideco_first");
    expect(orders).toContain("same_year");
  });
});
