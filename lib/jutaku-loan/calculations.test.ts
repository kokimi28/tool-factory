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
  totalRepayment,
  totalInterest,
} from "./calculations";

describe("QC6 境界値網羅（jutaku-loan・0/負/上限/性能区分）", () => {
  // auto-backlog Tier C QC6: 金経路の境界値を明示的に固定（既存テスト不変・新規追加のみ）。
  it("毎月返済額は借入負・返済年数0で0（下限クランプ）", () => {
    expect(monthlyPayment(-100, 1, 35)).toBe(0);
    expect(monthlyPayment(30_000_000, 1, 0)).toBe(0);
  });
  it("残高は経過月0以下で元金のまま（負もクランプ）", () => {
    expect(remainingBalanceAtMonth(30_000_000, 1, 35, 0)).toBe(30_000_000);
    expect(remainingBalanceAtMonth(30_000_000, 1, 35, -5)).toBe(30_000_000);
  });
  it("省エネ基準の借入限度額（一般3,000万・子育て4,000万）と控除期間", () => {
    expect(borrowingLimit("energy_saving", false)).toBe(30_000_000);
    expect(borrowingLimit("energy_saving", true)).toBe(40_000_000);
    expect(deductionYears("zeh")).toBe(13);
    expect(deductionYears("existing_certified")).toBe(10);
  });
  it("借入0は控除総額0（限度額は区分値のまま）", () => {
    const r = calcHomeLoanDeduction({ principal: 0, annualRatePercent: 1, years: 35, housingType: "zeh" });
    expect([r.limit, r.totalDeduction, r.schedule[0].deduction]).toEqual([35_000_000, 0, 0]);
  });
  it("高金利（3.0%）でも毎月返済額を算出（3,000万・35年→115,455）", () => {
    expect(monthlyPayment(30_000_000, 3.0, 35)).toBe(115_455);
  });
});

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
  it("記事 jutaku-loan-tenkyo-baikyaku（B11）の控除額アンカー（ZEH4,000万の1年目控除）", () => {
    // 記事の1年目控除額（住まなくなったときの説明用アンカー）を固定（品質ゲート①）。
    // 転居・賃貸化・売却時の継続/再開/終了は制度説明のため本文で扱う。
    const r = calcHomeLoanDeduction({ principal: 40_000_000, annualRatePercent: 0.8, years: 35, housingType: "zeh" });
    expect(r.schedule[0].deduction).toBe(245_000);
    expect(r.totalDeduction).toBe(2_915_500);
  });

  it("記事 jutaku-loan-kakutei-shinkoku（B8）の控除額アンカー（ZEH3,000万の初年度分）", () => {
    // 記事の初年度控除・総額（確定申告で受け取る額のアンカー）を固定（品質ゲート①）。
    // 手続き（初年度確定申告・2年目以降年末調整）は制度説明のため本文で扱う。
    const r = calcHomeLoanDeduction({ principal: 30_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    expect(r.schedule[0].deduction).toBe(204_900);
    expect(r.totalDeduction).toBe(2_252_200);
  });

  it("記事 jutaku-loan-pair-loan（B7）のペアローンの控除総額（二人分 vs 単独）", () => {
    // 記事のペアローン比較（夫3,000万＋妻2,000万＝各ZEH/1%/35年）と単独5,000万を固定（品質ゲート①）。
    const husband = calcHomeLoanDeduction({ principal: 30_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    const wife = calcHomeLoanDeduction({ principal: 20_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    expect([husband.schedule[0].deduction, husband.totalDeduction]).toEqual([204_900, 2_252_200]);
    expect([wife.schedule[0].deduction, wife.totalDeduction]).toEqual([136_600, 1_501_200]);
    const pairTotal = husband.totalDeduction + wife.totalDeduction;
    expect(pairTotal).toBe(3_753_400);
    const solo = calcHomeLoanDeduction({ principal: 50_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    expect([solo.limit, solo.totalDeduction]).toEqual([35_000_000, 3_172_500]);
    // ペアローンが単独より控除総額が大きい（記事の主張）
    expect(pairTotal).toBeGreaterThan(solo.totalDeduction);
  });

  it("記事 jutaku-loan-shotokuzei-zero（B9）の控除額アンカー（中古2,000万の1年目控除）", () => {
    // 記事の1年目控除額（住民税繰越の説明用アンカー）を固定（品質ゲート①）。
    // 住民税からの控除上限97,500円は法定値（国税庁 No.1211-1）で計算対象外のため本文で明記。
    const r = calcHomeLoanDeduction({ principal: 20_000_000, annualRatePercent: 1.0, years: 35, housingType: "existing_other" });
    expect(r.years).toBe(10);
    expect(r.schedule[0].deduction).toBe(136_600);
    expect(r.totalDeduction).toBe(1_209_100);
  });

  it("記事 jutaku-loan-getsugaku-hensai（B10）の毎月返済額・総返済額（借入額×金利別）", () => {
    // 記事の毎月返済額（元利均等・35年）と総返済額（毎月×420回）を固定（品質ゲート①）。
    const y = 35;
    expect(monthlyPayment(30_000_000, 0.5, y)).toBe(77_875);
    expect(monthlyPayment(30_000_000, 1.0, y)).toBe(84_685);
    expect(monthlyPayment(30_000_000, 1.5, y)).toBe(91_855);
    expect(monthlyPayment(30_000_000, 1.0, y) * y * 12).toBe(35_567_700);
    expect(monthlyPayment(30_000_000, 1.5, y) * y * 12).toBe(38_579_100);
    expect(monthlyPayment(40_000_000, 0.5, y)).toBe(103_834);
    expect(monthlyPayment(40_000_000, 1.0, y)).toBe(112_914);
    expect(monthlyPayment(40_000_000, 1.5, y)).toBe(122_473);
    expect(monthlyPayment(50_000_000, 0.5, y)).toBe(129_792);
    expect(monthlyPayment(50_000_000, 1.0, y)).toBe(141_142);
    expect(monthlyPayment(50_000_000, 1.5, y)).toBe(153_092);
    // 金利0.5%差の総額インパクト（3,000万・1.0%→1.5%で約301万円増）
    const diff = monthlyPayment(30_000_000, 1.5, y) * y * 12 - monthlyPayment(30_000_000, 1.0, y) * y * 12;
    expect(diff).toBe(3_011_400);
  });

  it("記事 jutaku-loan-chuko（B6）の中古の限度額・控除期間・総額", () => {
    // 記事の中古の借入限度額・控除期間10年・総額を固定（品質ゲート①）。
    expect(borrowingLimit("existing_certified", false)).toBe(30_000_000);
    expect(borrowingLimit("existing_other", false)).toBe(20_000_000);
    expect(deductionYears("existing_other")).toBe(10);
    const r = calcHomeLoanDeduction({ principal: 20_000_000, annualRatePercent: 1.0, years: 35, housingType: "existing_other" });
    expect([r.schedule[0].deduction, r.totalDeduction]).toEqual([136_600, 1_209_100]);
  });

  it("記事 jutaku-loan-kuriage-hensai（B5）の残高ベース控除と0.7%逆算", () => {
    // 記事の schedule 値（ZEH4,000万/0.8%/35年の6/13年目）を固定し、繰上げ効果の 0.7% を検証。
    const r = calcHomeLoanDeduction({ principal: 40_000_000, annualRatePercent: 0.8, years: 35, housingType: "zeh" });
    expect(r.schedule[5].deduction).toBe(237_300); // 6年目（残高が限度未満・残高ベース）
    expect(r.schedule[12].yearEndBalance).toBe(26_432_200);
    expect(r.schedule[12].deduction).toBe(185_000);
    // 繰上げ返済 500万円 → 控除は 500万×0.7% = 35,000円/年 減る（記事の目安）
    expect(Math.floor(5_000_000 * 0.007)).toBe(35_000);
  });

  it("記事 jutaku-loan-zeh-shouene（B4）の性能区分別の控除総額（一般世帯・6,000万/1%/35年）", () => {
    // 記事の性能区分別 総額を固定（品質ゲート①）。借入6,000万で残高が限度以上に推移する前提。
    const lt = calcHomeLoanDeduction({ principal: 60_000_000, annualRatePercent: 1.0, years: 35, housingType: "long_term" });
    const zeh = calcHomeLoanDeduction({ principal: 60_000_000, annualRatePercent: 1.0, years: 35, housingType: "zeh" });
    const es = calcHomeLoanDeduction({ principal: 60_000_000, annualRatePercent: 1.0, years: 35, housingType: "energy_saving" });
    expect([lt.limit, lt.schedule[0].deduction, lt.totalDeduction]).toEqual([45_000_000, 315_000, 4_025_900]);
    expect([zeh.limit, zeh.schedule[0].deduction, zeh.totalDeduction]).toEqual([35_000_000, 245_000, 3_185_000]);
    expect([es.limit, es.schedule[0].deduction, es.totalDeduction]).toEqual([30_000_000, 210_000, 2_730_000]);
  });

  it("記事 jutaku-loan-juminzei（B3）の中古2,000万の控除額（住民税枠の説明用）", () => {
    // 記事の控除額（中古2,000万・1年目136,600・10年総額1,209,100）を固定（品質ゲート①）。
    // 住民税からの控除上限97,500円は法定値（国税庁 No.1211-1）で計算対象外のため本文で明記。
    const r = calcHomeLoanDeduction({ principal: 20_000_000, annualRatePercent: 1.0, years: 35, housingType: "existing_other" });
    expect(r.years).toBe(10);
    expect(r.schedule[0].deduction).toBe(136_600);
    expect(r.totalDeduction).toBe(1_209_100);
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

describe("D7 総返済額・総利息（記事 jutaku-loan-getsugaku-hensai の金利別数値を固定）", () => {
  // auto-backlog 2巡目 Tier D7: 総返済額 = 毎月返済額 × 返済回数（元利均等・35年・借入3,000万）。
  // 記事本文の金利別の毎月返済額・総返済額・利息を calc 出力で二重化（§品質ゲート①）。
  const P = 30_000_000;
  const Y = 35;

  it("金利0.5%: 毎月77,875 / 総返済32,707,500 / 利息2,707,500", () => {
    expect(monthlyPayment(P, 0.5, Y)).toBe(77_875);
    expect(totalRepayment(P, 0.5, Y)).toBe(32_707_500);
    expect(totalInterest(P, 0.5, Y)).toBe(2_707_500);
  });

  it("金利1.0%: 毎月84,685 / 総返済35,567,700 / 利息5,567,700", () => {
    expect(monthlyPayment(P, 1.0, Y)).toBe(84_685);
    expect(totalRepayment(P, 1.0, Y)).toBe(35_567_700);
    expect(totalInterest(P, 1.0, Y)).toBe(5_567_700);
  });

  it("金利1.5%: 毎月91,855 / 総返済38,579,100 / 利息8,579,100", () => {
    expect(monthlyPayment(P, 1.5, Y)).toBe(91_855);
    expect(totalRepayment(P, 1.5, Y)).toBe(38_579_100);
    expect(totalInterest(P, 1.5, Y)).toBe(8_579_100);
  });

  it("金利1.0%→1.5%で総返済額は約301万円増（3,011,400）", () => {
    const diff = totalRepayment(P, 1.5, Y) - totalRepayment(P, 1.0, Y);
    expect(diff).toBe(3_011_400);
  });

  it("総利息は元金以下にクランプされない（借入0・年数0で0）", () => {
    expect(totalRepayment(0, 1.0, Y)).toBe(0);
    expect(totalInterest(30_000_000, 1.0, 0)).toBe(0);
  });
});
