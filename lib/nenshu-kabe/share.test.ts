/**
 * 年収の壁ツールの URL 共有マッピングのテスト（E3）。
 * 壁↔コードの round-trip と、未知コードのフォールバックを固定する。
 */
import { describe, it, expect } from "vitest";
import { wallToCode, codeToWall } from "./share";
import { SOCIAL_INSURANCE_WALLS } from "./calculations";

describe("E3 nenshu-kabe 壁の共有コード", () => {
  it("両方の壁で round-trip が一致する", () => {
    for (const wall of [SOCIAL_INSURANCE_WALLS.small, SOCIAL_INSURANCE_WALLS.standard] as const) {
      expect(codeToWall(wallToCode(wall))).toBe(wall);
    }
  });

  it("コードは 106 / 130 に対応する", () => {
    expect(wallToCode(SOCIAL_INSURANCE_WALLS.small)).toBe("106");
    expect(wallToCode(SOCIAL_INSURANCE_WALLS.standard)).toBe("130");
    expect(codeToWall("106")).toBe(SOCIAL_INSURANCE_WALLS.small);
    expect(codeToWall("130")).toBe(SOCIAL_INSURANCE_WALLS.standard);
  });

  it("未知コードは 130万の壁にフォールバック", () => {
    expect(codeToWall("999")).toBe(SOCIAL_INSURANCE_WALLS.standard);
    expect(codeToWall("")).toBe(SOCIAL_INSURANCE_WALLS.standard);
  });
});
