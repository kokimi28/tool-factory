/**
 * E6 壁をまたぐ手取り曲線データ表の妥当性テスト。
 * グリッドが壁の上下に広がること、壁で社保加入（enrolled）が false→true に切り替わること、
 * 壁を境に手取りが一時的に逆転（下がる）ことを両方の壁で固定する。
 */
import { describe, it, expect } from "vitest";
import { wallCurveIncomes } from "@/components/nenshu-kabe/WallCurveTable";
import {
  takeHomeWithWall,
  SOCIAL_INSURANCE_WALLS,
  type SiWall,
} from "./calculations";

const WALLS: SiWall[] = [SOCIAL_INSURANCE_WALLS.small, SOCIAL_INSURANCE_WALLS.standard];

describe("E6 壁をまたぐ手取り曲線", () => {
  for (const wall of WALLS) {
    describe(`${wall / 10_000}万円の壁`, () => {
      it("グリッドは昇順で、壁の直前・壁ちょうど・壁の上を含む", () => {
        const g = wallCurveIncomes(wall);
        expect(g.length).toBeGreaterThanOrEqual(4);
        for (let i = 1; i < g.length; i++) {
          expect(g[i]).toBeGreaterThan(g[i - 1]);
        }
        expect(g).toContain(wall);
        expect(g.some((x) => x < wall)).toBe(true);
        expect(g.some((x) => x > wall)).toBe(true);
      });

      it("社保加入は壁ちょうどで false→true に切り替わる", () => {
        expect(takeHomeWithWall(wall - 10_000, wall).enrolled).toBe(false);
        expect(takeHomeWithWall(wall, wall).enrolled).toBe(true);
      });

      it("壁を境に手取りが一時的に逆転する（働き損の谷）", () => {
        const below = takeHomeWithWall(wall - 10_000, wall).takeHome;
        const atWall = takeHomeWithWall(wall, wall).takeHome;
        expect(below).toBeGreaterThan(atWall);
      });
    });
  }
});
