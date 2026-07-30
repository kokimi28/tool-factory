/**
 * 住宅ローン控除の単体テスト（金経路＝誤値は CI で落とす）。
 * 期待値は令和6年入居基準（控除率0.7%・新築13年/中古10年・住宅性能別の借入限度額）を
 * 実装（元利均等の年末残高 × 0.7%）が再現した値で固定する。出典: 国税庁 No.1211-1。
 */
import { describe, it, expect } from "vitest";
import {
  monthlyPayment,
  remainingBalanceAtMonth,
  borrowingLimit,
  deductionYears,
  calcHomeLoanDeduction,
} from "./calculations";

describe("monthlyPayment — 元利均等の毎月返済額", () => {
  it("3,000万円・年1.0%・35年 → 84,685円", () => {
    expect(monthlyPayment(30_000_000, 1.0, 35)).toBe(84_685);
  });
  it("金利0%は元金÷回数（3,000万・30年 → 83,333円）", () => {
    expect(monthlyPayment(30_000_000, 0, 30)).toBe(83_333);
  });
  it("借入0は0", () => {
    expect(monthlyPayment(0, 1.0, 35)).toBe(0);
  });
});

describe("remainingBalanceAtMonth — 年末ローン残高", () => {
  it("3,000万・1.0%・35年の1年後残高 = 29,280,480円", () => {
    expect(remainingBalanceAtMonth(30_000_000, 1.0, 35, 12)).toBe(29_280_480);
  });
  it("完済月以降は0", () => {
    expect(remainingBalanceAtMonth(30_000_000, 1.0, 35, 35 * 12 + 1)).toBe(0);
  });
});

describe("borrowingLimit / deductionYears — 住宅性能別の限度額・控除期間", () => {
  it("ZEH水準（新築）: 一般3,500万・子育て4,500万・13年", () => {
    expect(borrowingLimit("zeh", false)).toBe(35_000_000);
    expect(borrowingLimit("zeh", true)).toBe(45_000_000);
    expect(deductionYears("zeh")).toBe(13);
  });
  it("長期優良・低炭素（新築）: 一般4,500万・子育て5,000万", () => {
    expect(borrowingLimit("long_term", false)).toBe(45_000_000);
    expect(borrowingLimit("long_term", true)).toBe(50_000_000);
  });
  it("既存その他（中古）: 2,000万・10年（世帯上乗せなし）", () => {
    expect(borrowingLimit("existing_other", false)).toBe(20_000_000);
    expect(borrowingLimit("existing_other", true)).toBe(20_000_000);
    expect(deductionYears("existing_other")).toBe(10);
  });
});

describe("calcHomeLoanDeduction — 各年・総額の控除見込み", () => {
  it("ZEH・4,000万/0.8%/35年: 限度3,500万・13年・総額2,915,500円", () => {
    const r = calcHomeLoanDeduction({
      principal: 40_000_000,
      annualRatePercent: 0.8,
      years: 35,
      housingType: "zeh",
    });
    expect(r.limit).toBe(35_000_000);
    expect(r.years).toBe(13);
    expect(r.totalDeduction).toBe(2_915_500);
    // 1年目: 残高が限度超 → 限度3,500万×0.7% = 245,000
    expect(r.schedule[0].eligibleBalance).toBe(35_000_000);
    expect(r.schedule[0].deduction).toBe(245_000);
    // 13年目: 残高が限度未満 → 残高26,432,200×0.7%（100円未満切捨）= 185,000
    expect(r.schedule[12].yearEndBalance).toBe(26_432_200);
    expect(r.schedule[12].deduction).toBe(185_000);
  });
  it("既存その他・2,500万/1.5%/20年: 限度2,000万・10年・総額1,251,200円", () => {
    const r = calcHomeLoanDeduction({
      principal: 25_000_000,
      annualRatePercent: 1.5,
      years: 20,
      housingType: "existing_other",
    });
    expect(r.limit).toBe(20_000_000);
    expect(r.years).toBe(10);
    expect(r.totalDeduction).toBe(1_251_200);
    expect(r.schedule[0].deduction).toBe(140_000); // 2,000万×0.7%
  });
  it("記事 jutaku-loan-kingaku-sim（B2）の借入額別（ZEH/1%/35年）の主数値", () => {
    // 記事の借入額別総額・毎月返済・1年目控除を固定（品質ゲート①）。
    const p30 = calcHomeLoanDeduction({ principal: 30_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    const p40 = calcHomeLoanDeduction({ principal: 40_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    const p50 = calcHomeLoanDeduction({ principal: 50_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    expect([p30.monthlyPayment, p30.schedule[0].deduction, p30.totalDeduction]).toEqual([84_685, 204_900, 2_252_200]);
    expect([p40.monthlyPayment, p40.schedule[0].deduction, p40.totalDeduction]).toEqual([112_914, 245_000, 2_930_400]);
    expect([p50.monthlyPayment, p50.schedule[0].deduction, p50.totalDeduction]).toEqual([141_142, 245_000, 3_172_500]);
  });

  it("記事 jutaku-loan-genndo-hayami（B1）の控除総額上限の早見（子育て・新築）", () => {
    // 残高が限度以上で推移する前提の13年総額を固定（記事の早見表数値・品質ゲート①）。
    const lt = calcHomeLoanDeduction({ principal: 60_000_000, annualRatePercent: 1.0, years: 35, housingType: "long_term", childRearingHousehold: true });
    const zeh = calcHomeLoanDeduction({ principal: 60_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh", childRearingHousehold: true });
    const es = calcHomeLoanDeduction({ principal: 60_000_000, annualRatePercent: 1.0, years: 35, housingType: "energy_saving", childRearingHousehold: true });
    expect([lt.limit, lt.schedule[0].deduction, lt.totalDeduction]).toEqual([50_000_000, 350_000, 4_300_300]);
    expect([zeh.limit, zeh.schedule[0].deduction, zeh.totalDeduction]).toEqual([45_000_000, 315_000, 4_025_900]);
    expect([es.limit, es.schedule[0].deduction, es.totalDeduction]).toEqual([40_000_000, 280_000, 3_640_000]);
  });

  it("記事 jutaku-loan-shikumi（B0）の worked example: ZEH4,000万/0.8%/35年の主数値", () => {
    // 記事本文の見出し数値（総額291万・1年目24.5万・13年目残高/控除）を固定。
    // 誤値が記事に載ると CI が赤 → 自走マージが止まる（auto-backlog §品質ゲート①）。
    const r = calcHomeLoanDeduction({
      principal: 40_000_000,
      annualRatePercent: 0.8,
      years: 35,
      housingType: "zeh",
    });
    expect(r.totalDeduction).toBe(2_915_500);
    expect(r.schedule[0].deduction).toBe(245_000); // 1年目=限度3,500万×0.7%
    expect(r.schedule[12].yearEndBalance).toBe(26_432_200); // 13年目残高
    expect(r.schedule[12].deduction).toBe(185_000);
    expect(monthlyPayment(30_000_000, 1.0, 35)).toBe(84_685); // 記事の毎月返済額の例
  });

  it("子育て世帯フラグで新築の限度額が上がり控除も増える", () => {
    const base = calcHomeLoanDeduction({
      principal: 50_000_000,
      annualRatePercent: 1.0,
      years: 35,
      housingType: "long_term",
    });
    const child = calcHomeLoanDeduction({
      principal: 50_000_000,
      annualRatePercent: 1.0,
      years: 35,
      housingType: "long_term",
      childRearingHousehold: true,
    });
    expect(base.limit).toBe(45_000_000);
    expect(child.limit).toBe(50_000_000);
    expect(child.schedule[0].deduction).toBeGreaterThan(base.schedule[0].deduction);
  });
});
