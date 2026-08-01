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

describe("記事 nenshu-kabe-double-work（C10）のダブルワーク合算の二重化", () => {
  // 記事の合算収入の手取り（未加入・税のみ）を固定（品質ゲート①）。
  // 扶養130万は合算判定、社保加入は勤務先ごと要件で calc 未モデルのため本文で明記。
  it("合算100万→手取り1,000,000（税0）・合算160万→手取り1,543,000（税57,000）", () => {
    expect(takeHomeAtIncome(1_000_000, false).takeHome).toBe(1_000_000);
    const c160 = takeHomeAtIncome(1_600_000, false);
    expect(c160.takeHome).toBe(1_543_000);
    expect(1_600_000 - c160.takeHome).toBe(57_000);
  });
});

describe("記事 nenshu-kabe-hatarakikata（C8）の働き方別 手取り比較の二重化", () => {
  // 記事の働き方別 手取り（106万の壁を跨ぐ/跨がない）を固定（品質ゲート①）。
  // 105万抑える=1,050,000 / 106万加入=903,650（逆転）/ 125万で105万時を上回る=1,065,625。
  it("105万1,050,000→106万903,650(逆転)→110万937,750→125万1,065,625→130万1,100,450", () => {
    expect(takeHomeWithWall(1_050_000, 1_060_000).takeHome).toBe(1_050_000);
    const at106 = takeHomeWithWall(1_060_000, 1_060_000);
    expect([at106.enrolled, at106.socialInsurance, at106.takeHome]).toEqual([true, 156_350, 903_650]);
    expect(takeHomeWithWall(1_100_000, 1_060_000).takeHome).toBe(937_750);
    expect(takeHomeWithWall(1_250_000, 1_060_000).takeHome).toBe(1_065_625);
    expect(takeHomeWithWall(1_300_000, 1_060_000).takeHome).toBe(1_100_450);
    // 働き損の解消: 125万の手取りが105万抑えたときを上回る
    expect(takeHomeWithWall(1_250_000, 1_060_000).takeHome).toBeGreaterThan(
      takeHomeWithWall(1_050_000, 1_060_000).takeHome,
    );
  });
});

describe("記事 nenshu-kabe-gakusei（C6）の通常非課税ライン103万の二重化", () => {
  // 記事の通常非課税ライン（年収103万→手取り103万＝税0）を固定（品質ゲート①）。
  // 勤労学生控除27万・親の扶養63万は法定値で calc 未モデルのため本文で明記しリンク誘導。
  it("年収103万→手取り1,030,000（通常の非課税ライン・税0）", () => {
    expect(takeHomeAtIncome(1_030_000, false).takeHome).toBe(1_030_000);
  });
});

describe("記事 nenshu-kabe-saiteki（C5）の回復ライン（最適年収）の二重化", () => {
  // 記事の回復ライン（130万→152万・106万→124万）を固定（品質ゲート①）。
  it("130万の壁 回復152万・106万の壁 回復124万（最適年収ライン）", () => {
    expect(analyzeWallReversal(1_300_000).recoveryIncome).toBe(1_520_000);
    expect(analyzeWallReversal(1_060_000).recoveryIncome).toBe(1_240_000);
  });
});

describe("記事 nenshu-kabe-150-201（C4）の本人手取りは逆転しないの二重化", () => {
  // 記事の手取り（社保加入者・150/160/201万で増え続ける）を固定（品質ゲート①）。
  it("150万→1,253,950・160万→1,330,600・201万→1,640,868（逆転せず増加）", () => {
    expect(takeHomeAtIncome(1_500_000, true).takeHome).toBe(1_253_950);
    expect(takeHomeAtIncome(1_600_000, true).takeHome).toBe(1_330_600);
    expect(takeHomeAtIncome(2_010_000, true).takeHome).toBe(1_640_868);
  });
});

describe("記事 nenshu-kabe-103（C3）の税の壁は緩やかの二重化", () => {
  // 記事の見出し数値（103万→手取り103万・110万→手取り109.3万＝税の壁は逆転しない）を固定。
  it("103万→手取り1,030,000・106万→1,060,000・110万→1,093,000（未加入・税の壁）", () => {
    expect(takeHomeAtIncome(1_030_000, false).takeHome).toBe(1_030_000);
    expect(takeHomeAtIncome(1_060_000, false).takeHome).toBe(1_060_000);
    expect(takeHomeAtIncome(1_100_000, false).takeHome).toBe(1_093_000);
  });
});

describe("記事 nenshu-kabe-130（C2）の worked example: 130万の壁の逆転と回復", () => {
  // 記事本文の見出し数値（129万→130万の谷・135/150万・152万回復）を固定（品質ゲート①）。
  it("129万1,264,000 → 130万 社保191,750/手取り1,100,450 → 135万1,138,875/150万1,253,950/152万回復1,269,300", () => {
    expect(takeHomeWithWall(1_290_000, 1_300_000).takeHome).toBe(1_264_000);
    const at130 = takeHomeWithWall(1_300_000, 1_300_000);
    expect([at130.socialInsurance, at130.takeHome]).toEqual([191_750, 1_100_450]);
    expect(takeHomeWithWall(1_350_000, 1_300_000).takeHome).toBe(1_138_875);
    expect(takeHomeWithWall(1_500_000, 1_300_000).takeHome).toBe(1_253_950);
    expect(takeHomeWithWall(1_520_000, 1_300_000).takeHome).toBe(1_269_300);
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
