/**
 * E4 furusato 計算の内訳の妥当性テスト。
 * Calculator の「計算の内訳（詳しく）」が表示する中間値（住民税所得割・限界税率・上限）が
 * calc の純関数と一致することを worked example で固定する（表示値＝calc 値の保証）。
 */
import { describe, it, expect } from "vitest";
import {
  calcFurusatoLimit,
  residentTaxLevy,
  marginalIncomeTaxRate,
} from "./calculations";

describe("E4 furusato 計算の内訳", () => {
  it("課税総所得 300万円: 住民税所得割は 30万円（課税所得×10%）", () => {
    expect(residentTaxLevy(3_000_000)).toBe(300_000);
    expect(calcFurusatoLimit(3_000_000).residentLevy).toBe(300_000);
  });

  it("内訳の各中間値は calc の純関数と一致（表示値＝calc 値）", () => {
    for (const taxable of [1_000_000, 3_000_000, 7_000_000]) {
      const r = calcFurusatoLimit(taxable);
      expect(r.residentLevy).toBe(residentTaxLevy(taxable));
      expect(r.marginalRate).toBe(marginalIncomeTaxRate(taxable));
      expect(r.limit).toBeGreaterThan(0);
    }
  });
});
