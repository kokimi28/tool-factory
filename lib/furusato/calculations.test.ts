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

describe("QC6 境界値網羅（furusato・0/負/上限/区分境界）", () => {
  // auto-backlog Tier C QC6: 金経路の境界値を明示的に固定（既存テスト不変・新規追加のみ）。
  it("負の課税所得は限度0・住民税所得割0（下限クランプ）", () => {
    expect(calcFurusatoLimit(-100).limit).toBe(0);
    expect(residentTaxLevy(-100)).toBe(0);
  });
  it("所得税率区分の境界で限度額が段差になる（1,950,000→47,939 / 1,950,001→50,878）", () => {
    expect(marginalIncomeTaxRate(1_950_000)).toBe(0.05);
    expect(marginalIncomeTaxRate(1_950_001)).toBe(0.1);
    expect(calcFurusatoLimit(1_950_000).limit).toBe(47_939);
    expect(calcFurusatoLimit(1_950_001).limit).toBe(50_878);
  });
  it("最高税率区分（課税所得5,000万・45%）の限度額と所得割", () => {
    const r = calcFurusatoLimit(50_000_000);
    expect([r.marginalRate, r.residentLevy, r.limit]).toEqual([0.45, 5_000_000, 2_271_889]);
  });
  it("住民税所得割は1円未満切り捨て（1,234,567→123,456）", () => {
    expect(residentTaxLevy(1_234_567)).toBe(123_456);
  });
  it("年収概算は負・低年収で課税所得0（下限クランプ）", () => {
    expect(estimateTaxableIncomeFromSalary({ annualIncome: -5 })).toBe(0);
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 1_000_000 })).toBe(0);
  });
});

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

describe("記事 furusato-taishokukin（A7）の退職金は限度額に載らないの二重化", () => {
  // 記事の主張（退職所得は分離課税で限度額に反映されない＝給与の課税所得だけで決まる）の
  // アンカーを固定（品質ゲート①）。退職所得の分離課税は制度説明のため本文で扱う。
  it("給与の課税所得300万 → 上限77,197（退職金を受けても変わらない）", () => {
    expect(calcFurusatoLimit(3_000_000).limit).toBe(77_197);
  });
});

describe("記事 furusato-6-jichitai（A11）の控除総額は不変の二重化", () => {
  // 記事の主張（6自治体以上で確定申告でも控除総額は同じ）のアンカーを固定（品質ゲート①）。
  // ワンストップ5自治体の上限は制度説明のため本文で扱い、上限額を anchor にする。
  it("課税所得300万 → 上限77,197（ワンストップでも確定申告でも同じ）", () => {
    expect(calcFurusatoLimit(3_000_000).limit).toBe(77_197);
  });
});

describe("記事 furusato-ikukyu（A9）の所得減で限度額が下がるの二重化", () => {
  // 記事の低年収域の限度額（育休で所得が減ると限度も下がる）を固定（品質ゲート①）。
  // 500万→60,704 / 300万→27,843 / 250万→21,341 / 200万→14,839（扶養なし概算）。
  it("年収500万→60,704・300万→27,843・250万→21,341・200万→14,839", () => {
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 5_000_000 }).limit).toBe(60_704);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 3_000_000 }).limit).toBe(27_843);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 2_500_000 }).limit).toBe(21_341);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 2_000_000 }).limit).toBe(14_839);
  });
});

describe("記事 furusato-kojin-jigyonushi（A8）の課税所得別限度額の二重化", () => {
  // 記事の課税所得別（事業所得ベース）の限度額を固定（品質ゲート①）。
  // 250万→64,664（率10%）/ 400万→116,975（率20%）/ 600万→174,463（率20%）。
  it("課税所得250万→64,664・400万→116,975・600万→174,463", () => {
    const r250 = calcFurusatoLimit(2_500_000);
    expect([r250.residentLevy, r250.marginalRate, r250.limit]).toEqual([250_000, 0.1, 64_664]);
    const r400 = calcFurusatoLimit(4_000_000);
    expect([r400.residentLevy, r400.marginalRate, r400.limit]).toEqual([400_000, 0.2, 116_975]);
    const r600 = calcFurusatoLimit(6_000_000);
    expect([r600.residentLevy, r600.marginalRate, r600.limit]).toEqual([600_000, 0.2, 174_463]);
  });
});

describe("記事 furusato-keisan-shiki（A10）の20%の壁の二重化", () => {
  // 記事の分解（特例分＝住民税所得割の20%）と限度額を固定（品質ゲート①）。
  // 300万: 所得割300,000・特例分上限60,000・限度額77,197 / 700万: 700,000・140,000・212,472。
  it("課税所得300万: 所得割300,000×20%=60,000・限度額77,197（率10%）", () => {
    expect(residentTaxLevy(3_000_000)).toBe(300_000);
    expect(residentTaxLevy(3_000_000) * 0.2).toBe(60_000);
    expect(marginalIncomeTaxRate(3_000_000)).toBe(0.1);
    expect(calcFurusatoLimit(3_000_000).limit).toBe(77_197);
  });
  it("課税所得700万: 所得割700,000×20%=140,000・限度額212,472（率23%）", () => {
    expect(residentTaxLevy(7_000_000)).toBe(700_000);
    expect(residentTaxLevy(7_000_000) * 0.2).toBe(140_000);
    expect(marginalIncomeTaxRate(7_000_000)).toBe(0.23);
    expect(calcFurusatoLimit(7_000_000).limit).toBe(212_472);
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

describe("D3 その他の所得控除（iDeCo/医療費/生保）で限度額が下がる", () => {
  // 2巡目 Tier D3: otherDeductions を課税総所得金額から差し引く。年収700万・扶養なしで固定。
  it("控除なし: 課税3,687,000 / 限度107,978", () => {
    const r = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 });
    expect(r.estimatedTaxableIncome).toBe(3_687_000);
    expect(r.limit).toBe(107_978);
  });

  it("その他控除27.6万（iDeCo満額相当）: 課税3,411,000 / 限度100,045", () => {
    const r = estimateFurusatoLimitFromSalary({
      annualIncome: 7_000_000,
      otherDeductions: 276_000,
    });
    expect(r.estimatedTaxableIncome).toBe(3_411_000);
    expect(r.limit).toBe(100_045);
  });

  it("その他控除が増えると限度額は下がる（単調非増加）", () => {
    const base = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 }).limit;
    const withDed = estimateFurusatoLimitFromSalary({
      annualIncome: 7_000_000,
      otherDeductions: 276_000,
    }).limit;
    expect(withDed).toBeLessThan(base);
  });

  it("otherDeductions 未指定・0・負は控除なしと同じ（後方互換）", () => {
    const none = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 }).limit;
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, otherDeductions: 0 }).limit).toBe(none);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, otherDeductions: -100 }).limit).toBe(none);
  });
});
