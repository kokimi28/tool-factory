/**
 * ふるさと納税 控除上限計算の単体テスト（金経路＝誤値は CI で落とす）。
 * 期待値は総務省の式（控除上限 = 住民税所得割 × 20% ÷ (90% − 所得税率×1.021) + 2,000）を
 * 実装が再現した値で固定する。
 */
import { describe, it, expect } from "vitest";
import {
  PERSONAL_DEDUCTION_DIFFERENCE,
  calcFurusatoLimit,
  deductionTaxSaving,
  deductionTradeoff,
  estimateFurusatoLimitFromSalary,
  estimateTaxableIncomeFromSalary,
  marginalIncomeTaxRate,
  personalDeductionDifference,
  residentTaxAdjustmentCredit,
  residentTaxLevy,
} from "./calculations";
import { RATE_EMP } from "../tedori/rates";
import { salaryIncomeDeduction } from "../tedori/calculations";

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
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 4_000_000 })).toBe(1_741_000);
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 6_000_000 })).toBe(3_047_000);
    expect(estimateTaxableIncomeFromSalary({ annualIncome: 8_000_000 })).toBe(4_492_000);
  });
  it("配偶者控除・扶養控除で課税所得が下がる（各38万円）", () => {
    const base = estimateTaxableIncomeFromSalary({ annualIncome: 6_000_000 });
    const withFamily = estimateTaxableIncomeFromSalary({
      annualIncome: 6_000_000,
      hasSpouse: true,
      dependents: 1,
    });
    expect(base - withFamily).toBe(660_000); // 38万 × 2
    expect(withFamily).toBe(2_387_000);
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
  // 500万→61,380 / 300万→28,456 / 250万→21,954 / 200万→15,428（扶養なし概算）。
  it("年収500万→61,380・300万→28,456・250万→21,954・200万→15,428", () => {
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 5_000_000 }).limit).toBe(61_380);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 3_000_000 }).limit).toBe(28_456);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 2_500_000 }).limit).toBe(21_954);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 2_000_000 }).limit).toBe(15_428);
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
  it("年収700万: 共働き108,754 / 配偶者99,269 / +扶養1 78,550 / +扶養2 70,279", () => {
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 }).limit).toBe(108_754);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true }).limit).toBe(99_269);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true, dependents: 1 }).limit).toBe(78_550);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true, dependents: 2 }).limit).toBe(70_279);
  });
});

describe("記事 furusato-limit-nenshu（A1）の年収別早見の二重化", () => {
  // 記事の早見表数値（扶養なし独身の概算・年収300/500/700/1000万）を固定。
  // 誤値が記事に載ると CI が赤 → 自走マージが止まる（auto-backlog §品質ゲート①）。
  it("年収300万→28,456 / 500万→61,380 / 700万→108,754 / 1000万→177,998", () => {
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 3_000_000 }).limit).toBe(28_456);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 5_000_000 }).limit).toBe(61_380);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 }).limit).toBe(108_754);
    expect(estimateFurusatoLimitFromSalary({ annualIncome: 10_000_000 }).limit).toBe(177_998);
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
  it("年収600万・扶養なし → 課税所得299.5万・上限77,748（記事の年収概算）", () => {
    const r = estimateFurusatoLimitFromSalary({ annualIncome: 6_000_000 });
    expect(r.estimatedTaxableIncome).toBe(3_047_000);
    expect(r.limit).toBe(77_748);
  });
});

describe("estimateFurusatoLimitFromSalary — 年収→上限（概算）", () => {
  it("年収600万・扶養なし → 課税所得3,047,000・上限77,748", () => {
    const r = estimateFurusatoLimitFromSalary({ annualIncome: 6_000_000 });
    expect(r.estimatedTaxableIncome).toBe(3_047_000);
    expect(r.limit).toBe(77_748);
  });
  it("年収600万・配偶者＋扶養1 → 課税所得2,387,000・上限61,205（家族が増えると上限は下がる）", () => {
    const r = estimateFurusatoLimitFromSalary({
      annualIncome: 6_000_000,
      hasSpouse: true,
      dependents: 1,
    });
    expect(r.estimatedTaxableIncome).toBe(2_387_000);
    expect(r.limit).toBe(61_205);
  });
});

describe("D3 その他の所得控除（iDeCo/医療費/生保）で限度額が下がる", () => {
  // 2巡目 Tier D3: otherDeductions を課税総所得金額から差し引く。年収700万・扶養なしで固定。
  it("控除なし: 課税3,739,000 / 限度108,754", () => {
    const r = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000 });
    expect(r.estimatedTaxableIncome).toBe(3_739_000);
    expect(r.limit).toBe(108_754);
  });

  it("その他控除27.6万（iDeCo満額相当）: 課税3,463,000 / 限度100,821", () => {
    const r = estimateFurusatoLimitFromSalary({
      annualIncome: 7_000_000,
      otherDeductions: 276_000,
    });
    expect(r.estimatedTaxableIncome).toBe(3_463_000);
    expect(r.limit).toBe(100_821);
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

describe("社会保険料の概算率が tedori の rates.ts と一致している（二重管理の再発防止）", () => {
  // かつて furusato は 0.1475 という独立した literal を持ち、tedori が令和8年度へ
  // 更新されたあとも取り残されていた。rates.ts から導出する形に変えたので、
  // 「rates.ts を更新したのに furusato が古いまま」という状態は作れない。
  // ここでは estimateTaxableIncomeFromSalary の出力から実効率を逆算して照合する。
  it("年収から逆算した社会保険料率が rates.ts の合計と一致する", () => {
    const expected =
      RATE_EMP.health + RATE_EMP.pension + RATE_EMP.employment + RATE_EMP.childCare;
    const income = 6_000_000;
    const employmentIncome = income - salaryIncomeDeduction(income);
    const taxable = estimateTaxableIncomeFromSalary({ annualIncome: income });
    // taxable = employmentIncome − 社保 − 基礎控除48万（1,000円未満切捨）
    // → 社保 ≒ employmentIncome − 480,000 − taxable
    const impliedSocialInsurance = employmentIncome - 430_000 - taxable;
    const impliedRate = impliedSocialInsurance / income;
    expect(Math.abs(impliedRate - expected)).toBeLessThan(0.0002);
    // 旧値 0.1475 に戻っていたら検出する
    expect(Math.abs(impliedRate - 0.1475)).toBeGreaterThan(0.0002);
  });

  it("介護保険料は概算に含めない（年齢依存のため・従来と同じ挙動）", () => {
    const expected =
      RATE_EMP.health + RATE_EMP.pension + RATE_EMP.employment + RATE_EMP.childCare;
    expect(expected).toBeLessThan(
      expected + RATE_EMP.nursing,
    );
    // 介護分を足した率は使っていない
    const income = 6_000_000;
    const employmentIncome = income - salaryIncomeDeduction(income);
    const taxable = estimateTaxableIncomeFromSalary({ annualIncome: income });
    const impliedRate = (employmentIncome - 430_000 - taxable) / income;
    expect(Math.abs(impliedRate - (expected + RATE_EMP.nursing))).toBeGreaterThan(0.002);
  });
});

describe('調整控除（地方税法37条・314条の6）', () => {
  it('人的控除差の表が条文どおり（特定18万＝所得税63万−住民税45万 と一致）', () => {
    expect(PERSONAL_DEDUCTION_DIFFERENCE.basic).toBe(50_000);
    expect(PERSONAL_DEDUCTION_DIFFERENCE.spouse).toBe(50_000);
    expect(PERSONAL_DEDUCTION_DIFFERENCE.dependentGeneral).toBe(50_000);
    expect(PERSONAL_DEDUCTION_DIFFERENCE.dependentSpecific).toBe(180_000);
    expect(PERSONAL_DEDUCTION_DIFFERENCE.dependentElderly).toBe(100_000);
    // 表の内部整合: 差額は「所得税の控除 − 住民税の控除」に一致する
    expect(PERSONAL_DEDUCTION_DIFFERENCE.dependentSpecific).toBe(630_000 - 450_000);
    expect(PERSONAL_DEDUCTION_DIFFERENCE.dependentElderly).toBe(480_000 - 380_000);
    expect(PERSONAL_DEDUCTION_DIFFERENCE.dependentGeneral).toBe(380_000 - 330_000);
  });

  it('人的控除差の合計は基礎控除ぶんを常に含み、家族で積み上がる', () => {
    expect(personalDeductionDifference({})).toBe(50_000);
    expect(personalDeductionDifference({ hasSpouse: true })).toBe(100_000);
    expect(personalDeductionDifference({ hasSpouse: true, dependents: 2 })).toBe(200_000);
    expect(personalDeductionDifference({ specificDependents: 1 })).toBe(230_000);
    expect(personalDeductionDifference({ elderlyDependents: 1 })).toBe(150_000);
  });

  it('合計課税所得200万円以下は min(差額, 課税所得) × 5%', () => {
    expect(residentTaxAdjustmentCredit(1_000_000, 50_000)).toBe(2_500);
    expect(residentTaxAdjustmentCredit(30_000, 50_000)).toBe(1_500); // 課税所得のほうが小さい
    expect(residentTaxAdjustmentCredit(2_000_000, 200_000)).toBe(10_000);
  });

  it('200万円超は max(差額 −(課税所得−200万), 5万円) × 5%', () => {
    // 差額5万・課税所得300万 → 5万 −100万 < 5万 なので下限5万 → 2,500円
    expect(residentTaxAdjustmentCredit(3_000_000, 50_000)).toBe(2_500);
    // 差額30万・課税所得210万 → 30万 −10万 ＝ 20万 → 10,000円
    expect(residentTaxAdjustmentCredit(2_100_000, 300_000)).toBe(10_000);
  });

  it('課税所得が0なら調整控除も0', () => {
    expect(residentTaxAdjustmentCredit(0, 200_000)).toBe(0);
  });

  it('調整控除を引くぶん限度額は下がる（税額控除であって所得控除ではない）', () => {
    const withCredit = calcFurusatoLimit(3_000_000, { adjustmentCredit: 2_500 });
    const without = calcFurusatoLimit(3_000_000);
    expect(withCredit.residentLevy).toBe(without.residentLevy - 2_500);
    expect(withCredit.limit).toBeLessThan(without.limit);
  });
});

describe('年収からの概算は住民税ベースの人的控除を使う', () => {
  it('扶養親族の年齢区分が限度額に効く（特定・老人で額が違う）', () => {
    const base = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true });
    const general = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true, dependents: 1 });
    const specific = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true, specificDependents: 1 });
    const elderly = estimateFurusatoLimitFromSalary({ annualIncome: 7_000_000, hasSpouse: true, elderlyDependents: 1 });
    // 住民税の控除額 一般33万 < 老人38万 < 特定45万 → 控除が大きいほど限度額は下がる
    expect(general.limit).toBeLessThan(base.limit);
    expect(elderly.limit).toBeLessThan(general.limit);
    expect(specific.limit).toBeLessThan(elderly.limit);
  });

  it('基礎控除は住民税の43万円（所得税の48万・58万ではない）', () => {
    const r = estimateFurusatoLimitFromSalary({ annualIncome: 6_000_000 });
    expect(r.estimatedTaxableIncome).toBe(3_047_000);
  });
});

describe('所得控除のトレードオフ（限度額は下がるが税はもっと減る）', () => {
  it('節税額は 控除額 ×（住民税10% ＋ 所得税限界税率×1.021）', () => {
    const r = deductionTaxSaving(276_000, 3_000_000);
    expect(r.marginalRate).toBe(0.1);
    expect(r.residentTax).toBe(Math.floor(276_000 * 0.1));
    expect(r.incomeTax).toBe(Math.floor(276_000 * 0.1 * 1.021));
    expect(r.total).toBe(r.incomeTax + r.residentTax);
  });

  it('限界税率が上がると節税額も増える', () => {
    const low = deductionTaxSaving(276_000, 3_000_000).total;
    const high = deductionTaxSaving(276_000, 5_000_000).total;
    expect(high).toBeGreaterThan(low);
  });

  it('記事の例（課税所得300万・iDeCo27.6万）が実装と一致する', () => {
    const t = deductionTradeoff(3_000_000, 276_000);
    expect(t.limitBefore).toBe(77_197);
    expect(t.limitAfter).toBe(70_279);
    expect(t.limitDecrease).toBe(6_918);
    expect(t.taxSaving).toBe(55_779);
    expect(t.netGain).toBe(48_861);
  });

  it('どの課税所得でも節税額のほうが限度額の目減りより大きい（向きが変わらない）', () => {
    for (let taxable = 500_000; taxable <= 20_000_000; taxable += 500_000) {
      const t = deductionTradeoff(taxable, 276_000);
      expect(t.netGain).toBeGreaterThan(0);
      expect(t.ratio).toBeGreaterThan(1);
    }
  });

  it('課税所得が高いほど倍率が大きい（節税は累進・目減りは一律10%のため）', () => {
    const low = deductionTradeoff(2_000_000, 276_000).ratio;
    const mid = deductionTradeoff(3_000_000, 276_000).ratio;
    const high = deductionTradeoff(5_000_000, 276_000).ratio;
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it('控除0なら何も起きない', () => {
    const t = deductionTradeoff(3_000_000, 0);
    expect(t.limitDecrease).toBe(0);
    expect(t.taxSaving).toBe(0);
    expect(t.ratio).toBe(Number.POSITIVE_INFINITY);
  });
});
