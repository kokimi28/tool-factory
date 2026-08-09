/**
 * 住宅ローン控除ツールの URL 共有ヘルパーのテスト（E3）。
 * 住宅種別の復元・フォールバックと真偽フラグの相互変換を固定する。
 */
import { describe, it, expect } from "vitest";
import { parseHousingType, boolToFlag, flagToBool } from "./share";
import { calcHomeLoanDeduction, type HousingType } from "./calculations";

const ALL_TYPES: HousingType[] = [
  "long_term",
  "zeh",
  "energy_saving",
  "existing_certified",
  "existing_other",
];

describe("E3 jutaku-loan 共有ヘルパー", () => {
  it("全ての住宅種別を復元し、計算も走る", () => {
    for (const t of ALL_TYPES) {
      expect(parseHousingType(t)).toBe(t);
      const r = calcHomeLoanDeduction({
        principal: 30_000_000,
        annualRatePercent: 1.0,
        years: 35,
        housingType: parseHousingType(t),
        childRearingHousehold: false,
      });
      expect(r.totalDeduction).toBeGreaterThan(0);
    }
  });

  it("未知の住宅種別は zeh にフォールバック", () => {
    expect(parseHousingType("")).toBe("zeh");
    expect(parseHousingType("unknown")).toBe("zeh");
  });

  it("真偽フラグは round-trip する", () => {
    expect(flagToBool(boolToFlag(true))).toBe(true);
    expect(flagToBool(boolToFlag(false))).toBe(false);
    expect(flagToBool("1")).toBe(true);
    expect(flagToBool("0")).toBe(false);
  });
});
