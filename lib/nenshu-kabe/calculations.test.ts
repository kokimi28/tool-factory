/**
 * 年収の壁 手取り逆転の単体テスト。手取り算定は tedori と同一仕様であることを固定し、
 * 壁（106万/130万）での逆転の谷と回復年収を実装出力でロックする（誤値は CI で落とす）。
 */
import { describe, it, expect } from "vitest";
import {
  takeHomeAtIncome,
  takeHomeWithWall,
  analyzeWallReversal,
} from "./calculations";
import { calculateNetSalary } from "../tedori/calculations";

describe("takeHomeAtIncome — tedori と同一仕様（加入時）", () => {
  it("enrolled=true は tedori の calculateNetSalary と一致（二重管理しない保証）", () => {
    for (const inc of [1_300_000, 3_000_000, 5_000_000, 8_000_000]) {
      const mine = takeHomeAtIncome(inc, true).takeHome;
      const tedori = calculateNetSalary({ annualIncome: inc, isOver40: false }).takeHome;
      expect(mine).toBe(tedori);
    }
  });
  it("扶養内（未加入）は社会保険料0・低年収は税もほぼ0で手取り≒年収", () => {
    const r = takeHomeAtIncome(1_000_000, false);
    expect(r.socialInsurance).toBe(0);
    expect(r.takeHome).toBe(1_000_000);
  });
});

describe("記事 nenshu-kabe-106（C1）の worked example: 106万の壁の前後", () => {
  // 記事本文の見出し数値（105万→手取り105万・106万→社保156,350/手取り903,650・124万回復）を固定。
  // 誤値が記事に載ると CI が赤 → 自走マージが止まる（auto-backlog §品質ゲート①）。
  it("105万未加入1,050,000 → 106万加入 社保156,350/手取り903,650 → 124万回復1,057,100", () => {
    expect(takeHomeWithWall(1_050_000, 1_060_000).takeHome).toBe(1_050_000);
    const at106 = takeHomeWithWall(1_060_000, 1_060_000);
    expect([at106.enrolled, at106.socialInsurance, at106.takeHome]).toEqual([true, 156_350, 903_650]);
    expect(takeHomeWithWall(1_240_000, 1_060_000).takeHome).toBe(1_057_100);
  });
});

describe("takeHomeWithWall — 130万の壁の前後", () => {
  it("129万は未加入・手取り1,264,000", () => {
    const r = takeHomeWithWall(1_290_000, 1_300_000);
    expect(r.enrolled).toBe(false);
    expect(r.socialInsurance).toBe(0);
    expect(r.takeHome).toBe(1_264_000);
  });
  it("130万は加入・社会保険料191,750・手取り1,100,450（谷）", () => {
    const r = takeHomeWithWall(1_300_000, 1_300_000);
    expect(r.enrolled).toBe(true);
    expect(r.socialInsurance).toBe(191_750);
    expect(r.takeHome).toBe(1_100_450);
  });
});

describe("記事 nenshu-kabe-guide（C0）の worked example トレーサビリティ", () => {
  // 記事本文の2つの見出し数値を1ケースで束ね、記事 slug に紐づけて固定する
  // （誤値が記事に載ると CI が赤 → 自走マージが止まる。auto-backlog §品質ゲート①）。
  it("130万=drop163,550/回復152万・106万=drop146,350/回復124万（記事の主数値）", () => {
    const w130 = analyzeWallReversal(1_300_000);
    const w106 = analyzeWallReversal(1_060_000);
    expect([w130.dropAtWall, w130.recoveryIncome]).toEqual([163_550, 1_520_000]);
    expect([w106.dropAtWall, w106.recoveryIncome]).toEqual([146_350, 1_240_000]);
  });
});

describe("analyzeWallReversal — 逆転の谷と回復年収", () => {
  it("130万の壁: 手取り163,550円ダウン・回復年収152万円（+22万）", () => {
    const r = analyzeWallReversal(1_300_000);
    expect(r.takeHomeJustBelow).toBe(1_264_000);
    expect(r.takeHomeAtWall).toBe(1_100_450);
    expect(r.dropAtWall).toBe(163_550);
    expect(r.recoveryIncome).toBe(1_520_000);
    expect(r.extraIncomeToRecover).toBe(220_000);
  });
  it("106万の壁: 手取り146,350円ダウン・回復年収124万円（+18万）", () => {
    const r = analyzeWallReversal(1_060_000);
    expect(r.dropAtWall).toBe(146_350);
    expect(r.recoveryIncome).toBe(1_240_000);
    expect(r.extraIncomeToRecover).toBe(180_000);
  });
});
