/**
 * ふるさと納税 控除上限計算の単体テスト（金経路＝誤値は CI で落とす）。
 * 期待値は総務省の式（控除上限 = 住民税所得割 × 20% ÷ (90% − 所得税率×1.021) + 2,000）を
 * 実装が再現した値で固定する。
 */
import { describe, it, expect } from "vitest";
import {
  calcFurusatoLimit,
  marginalIncomeTaxRate,
  residentTaxLevy,
  estimateTaxableIncomeFromSalary,
  estimateFurusatoLimitFromSalary,
} from "./calculations";

describe("marginalIncomeTaxRate — 課税総所得に対する限界税率", () => {
  it("各区分の境界", () => {
    expect(marginalIncomeTaxRate(1_950_000)).toBe(0.05);
    expect(marginalIncomeTaxRate(1_950_001)).toBe(0.1);
    expect(marginalIncomeTaxRate(3_300_000)).toBe(0.1);
    expect(marginalIncomeTaxRate(6_950_000)).toBe(0.2);
    expect(marginalIncomeTaxRate(9_000_000)).toBe(0.23);
    expect(marginalIncomeTaxRate(18_000_000)).toBe(0.33);
    expect(marginalIncomeTaxRate(40_000_000)).toBe(0.4);
    expect(marginalIncomeTaxRate(40_000_001)).toBe(0.45);
  });
  it("0以下は5%区分（下限）", () => {
    expect(marginalIncomeTaxRate(0)).toBe(0.05);
  });
});

describe("residentTaxLevy — 住民税所得割（10%・1円未満切り捨て）", () => {
  it("課税所得×10%", () => {
    expect(residentTaxLevy(3_000_000)).toBe(300_000);
    expect(residentTaxLevy(2_345_678)).toBe(234_567);
    expect(residentTaxLevy(0)).toBe(0);
  });
});

describe("calcFurusatoLimit — 控除上限（課税総所得金額から・総務省の式）", () => {
  it("課税所得200万（10%区分）→ 上限52,131", () => {
    const r = calcFurusatoLimit(2_000_000);
    expect(r.marginalRate).toBe(0.1);
    expect(r.residentLevy).toBe(200_000);
    expect(r.limit).toBe(52_131);
  });
  it("課税所得300万（10%区分）→ 上限77,197", () => {
    expect(calcFurusatoLimit(3_000_000).limit).toBe(77_197);
  });
  it("課税所得500万（20%区分）→ 上限145,719", () => {
    const r = calcFurusatoLimit(5_000_000);
    expect(r.marginalRate).toBe(0.2);
    expect(r.limit).toBe(145_719);
  });
  it("課税所得900万（23%区分）→ 上限272,607", () => {
    expect(calcFurusatoLimit(9_000_000).limit).toBe(272_607);
  });
  it("課税所得0は上限0", () => {
    expect(calcFurusatoLimit(0).limit).toBe(0);
  });
});

describe("estimateTaxableIncomeFromSalary — 年収→課税総所得金額（概算・給与所得者）", () => {
  it("扶養なしの概算（1,000円未満切り捨て）", () => {
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 4_000_000 })).toBe(1_690_000);
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 6_000_000 })).toBe(2_995_000);
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 8_000_000 })).toBe(4_440_000);
  });
  it("配偶者控除・扶養控除で課税所得が下がる（各38万円）", () => {
    const base = estimateTaxableIncomeFromSalary({ annualIncome: 6_000_000 });
    const withFamily = estimateTaxableIncomeFromSalary({
      annualIncome: 6_000_000,
      hasSpouse: true,
      dependents: 1,
    });
    expect(base - withFamily).toBe(760_000); // 38万 × 2
    expect(withFamily).toBe(2_235_000);
  });
  it("年収0は課税所得0", () => {
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 0 })).toBe(0);
  });
});

describe("記事 furusato-jutaku-loan（A6）の所得税取り合いの数値アンカー", () => {
  // 記事が使う課税所得300万の上限77,197・住民税所得割300,000を固定（住宅ローン控除との併用説明用）。
  it("課税所得300万 → 上限77,197・住民税所得割300,000", () => {
    expect(calcFurusatoLimit(3_000_000).limit).toBe(77_197);
    expect(residentTaxLevy(3_000_000)).toBe(300_000);
  });
});

describe("記事 furusato-ideco-iryohi（A5）のiDeCo併用の二重化", () => {
  // 記事の見出し数値（課税所得300万→272.4万で上限77,197→70,279）を固定（品質ゲート①）。
  it("iDeCo年27.6万で課税所得300万→272.4万・上限77,197→70,279", () => {
    expect(calcFurusatoLimit(3_000_000).limit).toBe(77_197);
    expect(calcFurusatoLimit(2_724_000).limit).toBe(70_279);
  });
});

describe("記事 furusato-onestop-kakutei（A4）の内訳説明の数値アンカー", () => {
  // 記事が使う課税所得300万の上限77,197・住民税所得割300,000を固定（内訳が変わっても総額は同じ）。
  it("課税所得300万 → 上限77,197・住民税所得割300,000", () => {
    expect(calcFurusatoLimit(3_000_000).limit).toBe(77_197);
    expect(residentTaxLevy(3_000_000)).toBe(300_000);
  });
});

describe("記事 furusato-limit-koeta（A3）の超過自己負担の二重化", () => {
  // 記事の実額（上限77,197・10万寄付→超過22,803・自己負担24,803）を calc の上限から固定。
  it("課税所得300万・10万寄付 → 超過22,803・自己負担24,803（上限77,197から）", () => {
    const limit = calcFurusatoLimit(3_000_000).limit;
    expect(limit).toBe(77_197);
    const donation = 100_000;
    const excess = donation - limit;
    expect(excess).toBe(22_803);
    expect(2_000 + excess).toBe(24_803);
  });
});

describe("記事 furusato-tomobataraki-fuyou（A2）の家族構成別の二重化", () => {
  // 記事の年収700万・家族構成別の限度額を固定（品質ゲート①）。
  it("年収700万: 共働き107,978 / 配偶者97,056 / +扶養1 75,367 / +扶養2 65,842", () => {
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 }).limit).toBe(107_978);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true }).limit).toBe(97_056);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true, dependents: 1 }).limit).toBe(75_367);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true, dependents: 2 }).limit).toBe(65_842);
  });
});

describe("記事 furusato-limit-nenshu（A1）の年収別早見の二重化", () => {
  // 記事の早見表数値（扶養なし独身の概算・年収300/500/700/1000万）を固定。
  // 誤値が記事に載ると CI が赤 → 自走マージが止まる（auto-backlog §品質ゲート①）。
  it("年収300万→27,843 / 500万→60,704 / 700万→107,978 / 1000万→177,194", () => {
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 3_000_000 }).limit).toBe(27_843);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 5_000_000 }).limit).toBe(60_704);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 }).limit).toBe(107_978);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 10_000_000 }).limit).toBe(177_194);
  });
});

describe("記事 furusato-limit-shikumi（A0）の worked example の二重化", () => {
  // 記事本文で使う2つの見出し数値を、結果オブジェクト全体で固定する
  // （誤値が記事に載ると CI が赤 → 自走マージが止まる。auto-backlog §品質ゲート①）。
  it("課税所得300万 → 住民税所得割30万・税率10%・上限77,197（記事の主計算）", () => {
    expect(calcFurusatoLimit(3_000_000)).toEqual({
      limit: 77_197,
      residentLevy: 300_000,
      marginalRate: 0.1,
    });
  });
  it("年収600万・扶養なし → 課税所得299.5万・上限77,072（記事の年収概算）", () => {
    const r = estimateFurusatoLimitFromSalary({ annualIncome: 6_000_000 });
    expect(r.estimatedTaxableIncome).toBe(2_995_000);
    expect(r.limit).toBe(77_072);
  });
});

describe("estimateFurusatoLimitFromSalary — 年収→上限（概算）", () => {
  it("年収600万・扶養なし → 課税所得2,995,000・上限77,072", () => {
    const r = estimateFurusatoLimitFromSalary({ annualIncome: 6_000_000 });
    expect(r.estimatedTaxableIncome).toBe(2_995_000);
    expect(r.limit).toBe(77_072);
  });
  it("年収600万・配偶者＋扶養1 → 課税所得2,235,000・上限58,022（家族が増えると上限は下がる）", () => {
    const r = estimateFurusatoLimitFromSalary({
      annualIncome: 6_000_000,
      hasSpouse: true,
      dependents: 1,
    });
    expect(r.estimatedTaxableIncome).toBe(2_235_000);
    expect(r.limit).toBe(58_022);
  });
});
