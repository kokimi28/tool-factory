import { describe, it, expect } from "vitest";
import {
  salaryIncomeDeduction,
  basicDeductionIncomeTax,
  incomeTaxByBracket,
  socialInsurance,
  calculateNetSalary,
} from "./calculations";

describe("salaryIncomeDeduction — 給与所得控除（令和7年分以降）", () => {
  it("190万円以下は最低保障65万円", () => {
    expect(salaryIncomeDeduction(1_000_000)).toBe(650_000);
    expect(salaryIncomeDeduction(1_900_000)).toBe(650_000);
  });
  it("区分ごとの速算表", () => {
    expect(salaryIncomeDeduction(3_600_000)).toBe(1_160_000); // 30%+8万
    expect(salaryIncomeDeduction(6_600_000)).toBe(1_760_000); // 20%+44万
    expect(salaryIncomeDeduction(8_500_000)).toBe(1_950_000); // 10%+110万
  });
  it("850万円超は上限195万円", () => {
    expect(salaryIncomeDeduction(10_000_000)).toBe(1_950_000);
  });
});

describe("basicDeductionIncomeTax — 基礎控除（令和7〜8年分・合計所得別）", () => {
  it("各区分の境界", () => {
    expect(basicDeductionIncomeTax(1_320_000)).toBe(950_000);
    expect(basicDeductionIncomeTax(1_320_001)).toBe(880_000);
    expect(basicDeductionIncomeTax(3_360_000)).toBe(880_000);
    expect(basicDeductionIncomeTax(3_360_001)).toBe(680_000);
    expect(basicDeductionIncomeTax(4_890_000)).toBe(680_000);
    expect(basicDeductionIncomeTax(4_890_001)).toBe(630_000);
    expect(basicDeductionIncomeTax(6_550_000)).toBe(630_000);
    expect(basicDeductionIncomeTax(6_550_001)).toBe(580_000);
    expect(basicDeductionIncomeTax(23_500_000)).toBe(580_000);
  });
});

describe("incomeTaxByBracket — 所得税速算表の境界", () => {
  it("195万・330万の境界", () => {
    expect(incomeTaxByBracket(1_949_000)).toBe(97_450);
    expect(incomeTaxByBracket(1_950_000)).toBe(97_500);
    expect(incomeTaxByBracket(3_300_000)).toBe(232_500);
  });
  it("695万・900万の境界（20%→23%→33%）", () => {
    expect(incomeTaxByBracket(6_949_000)).toBe(962_300);
    expect(incomeTaxByBracket(6_950_000)).toBe(962_500);
    expect(incomeTaxByBracket(8_999_000)).toBe(1_433_770);
    expect(incomeTaxByBracket(9_000_000)).toBe(1_434_000);
  });
  it("1800万・4000万の境界（33%→40%→45%）", () => {
    expect(incomeTaxByBracket(17_999_000)).toBe(4_403_670);
    expect(incomeTaxByBracket(18_000_000)).toBe(4_404_000);
    expect(incomeTaxByBracket(39_999_000)).toBe(13_203_600);
    expect(incomeTaxByBracket(40_000_000)).toBe(13_204_000); // 45% 区分に入る
    expect(incomeTaxByBracket(50_000_000)).toBe(17_704_000);
  });
  it("課税0は税0", () => {
    expect(incomeTaxByBracket(0)).toBe(0);
  });
});

describe("socialInsurance — 社会保険料（従業員負担）", () => {
  it("40歳未満は介護保険なし", () => {
    const si = socialInsurance(4_000_000, false);
    expect(si.health).toBe(200_000);
    expect(si.nursing).toBe(0);
    expect(si.pension).toBe(366_000);
    expect(si.employment).toBe(24_000);
    expect(si.total).toBe(590_000);
  });
  it("40歳以上は介護保険が加わる", () => {
    const si = socialInsurance(4_000_000, true);
    expect(si.nursing).toBe(Math.round(4_000_000 * 0.00795)); // 31,800
    expect(si.total).toBe(590_000 + si.nursing);
  });
  it("厚生年金は標準報酬月額上限（年780万相当）で頭打ち", () => {
    const hi = socialInsurance(20_000_000, false);
    expect(hi.pension).toBe(Math.round(7_800_000 * 0.0915)); // 713,700 で頭打ち
  });
  it("健康保険・介護保険は標準報酬月額上限（年1,668万相当）で頭打ち", () => {
    const hi = socialInsurance(20_000_000, true);
    expect(hi.health).toBe(834_000); // min(2,000万, 1,668万) × 5% で頭打ち
    expect(hi.nursing).toBe(132_606); // 同上限 × 0.795%
    // 雇用保険は上限なし＝全額に率がかかる
    expect(hi.employment).toBe(120_000); // 2,000万 × 0.6%
  });
});

describe("calculateNetSalary — 年収400万・40歳未満（基準ケース）", () => {
  const r = calculateNetSalary({ annualIncome: 4_000_000, isOver40: false });
  it("社会保険料・所得税・住民税・手取り", () => {
    expect(r.socialInsurance).toBe(590_000);
    expect(r.salaryDeduction).toBe(1_240_000);
    expect(r.employmentIncome).toBe(2_760_000);
    expect(r.taxableIncomeForIncomeTax).toBe(1_290_000);
    expect(r.incomeTax).toBe(65_854);
    expect(r.residentTax).toBe(179_000);
    expect(r.totalDeduction).toBe(834_854);
    expect(r.takeHome).toBe(3_165_146);
    expect(r.takeHomeMonthly).toBe(263_762);
  });
});

describe("calculateNetSalary — 年収600万・40歳未満", () => {
  const r = calculateNetSalary({ annualIncome: 6_000_000, isOver40: false });
  it("内訳と手取り", () => {
    expect(r.socialInsurance).toBe(885_000);
    expect(r.employmentIncome).toBe(4_360_000);
    expect(r.incomeTax).toBe(185_822);
    expect(r.residentTax).toBe(309_500);
    expect(r.takeHome).toBe(4_619_678);
  });
});

describe("calculateNetSalary — 整合性・低所得・境界", () => {
  it("手取り = 年収 − (社会保険料 + 所得税 + 住民税)", () => {
    for (const income of [1_000_000, 3_000_000, 5_000_000, 8_000_000, 12_000_000]) {
      const r = calculateNetSalary({ annualIncome: income, isOver40: true });
      expect(r.takeHome).toBe(income - (r.socialInsurance + r.incomeTax + r.residentTax));
      expect(r.totalDeduction).toBe(r.socialInsurance + r.incomeTax + r.residentTax);
    }
  });
  it("年収100万は所得税・住民税ともゼロ（社会保険料のみ差引）", () => {
    const r = calculateNetSalary({ annualIncome: 1_000_000, isOver40: false });
    expect(r.incomeTax).toBe(0);
    expect(r.residentTax).toBe(0);
    // 社会保険料（健保5%＋厚年9.15%＋雇用0.6%＝約14.75%）のみ引かれる
    expect(r.takeHome).toBe(1_000_000 - r.socialInsurance);
    expect(r.takeHomeRate).toBeGreaterThan(0.84);
  });
  it("年収0は全項目0", () => {
    const r = calculateNetSalary({ annualIncome: 0, isOver40: false });
    expect(r.takeHome).toBe(0);
    expect(r.totalDeduction).toBe(0);
    expect(r.takeHomeRate).toBe(0);
  });
});

describe("記事 worked example: 40歳の介護保険料と手取り（kaigo-hoken-40sai-tedori 記事の裏取り）", () => {
  // 年収500万・扶養なしで 40歳未満 vs 40歳以上
  const under = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
  const over = calculateNetSalary({ annualIncome: 5_000_000, isOver40: true });
  it("40歳未満: 社保737,500・手取り3,899,150・月324,929", () => {
    expect(under.socialInsurance).toBe(737_500);
    expect(under.nursingInsurance).toBe(0);
    expect(under.takeHome).toBe(3_899_150);
    expect(under.takeHomeMonthly).toBe(324_929);
  });
  it("40歳以上: 介護39,750・社保777,250・手取り3,867,484・月322,290", () => {
    expect(over.nursingInsurance).toBe(39_750);
    expect(over.socialInsurance).toBe(777_250);
    expect(over.takeHome).toBe(3_867_484);
    expect(over.takeHomeMonthly).toBe(322_290);
  });
  it("差額: 年31,666・月2,639", () => {
    expect(under.takeHome - over.takeHome).toBe(31_666);
    expect(under.takeHomeMonthly - over.takeHomeMonthly).toBe(2_639);
  });
});

describe("記事 worked example: 社会保険料の内訳（shakai-hoken-uchiwake-tedori 記事の裏取り）", () => {
  // 年収500万・扶養なし・40歳未満
  const r = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
  it("内訳: 健保250,000・厚年457,500・雇用30,000・合計737,500", () => {
    expect(r.healthInsurance).toBe(250_000);
    expect(r.pensionInsurance).toBe(457_500);
    expect(r.employmentInsurance).toBe(30_000);
    expect(r.socialInsurance).toBe(737_500);
  });
  it("記事で言及する所得税119,150・住民税244,200", () => {
    expect(r.incomeTax).toBe(119_150);
    expect(r.residentTax).toBe(244_200);
  });
});

describe("記事 worked example: 手取りから年収逆算の早見表（tedori-kara-nenshu-gyakusan 記事の裏取り）", () => {
  // 会社員・扶養なし・40歳未満の年収→手取り（記事の早見表の各行）
  const table: Array<[number, number, number]> = [
    // [annualIncome, takeHome, takeHomeMonthly]
    [3_000_000, 2_402_219, 200_185],
    [4_000_000, 3_165_146, 263_762],
    [5_000_000, 3_899_150, 324_929],
    [6_000_000, 4_619_678, 384_973],
    [7_000_000, 5_303_023, 441_919],
  ];
  for (const [inc, takeHome, monthly] of table) {
    it(`年収${inc / 10_000}万: 手取り${takeHome}・月${monthly}`, () => {
      const r = calculateNetSalary({ annualIncome: inc, isOver40: false });
      expect(r.takeHome).toBe(takeHome);
      expect(r.takeHomeMonthly).toBe(monthly);
    });
  }
  it("手取り率は年収とともに低下する（累進課税・逆算が固定倍率でない根拠）", () => {
    const r300 = calculateNetSalary({ annualIncome: 3_000_000, isOver40: false });
    const r700 = calculateNetSalary({ annualIncome: 7_000_000, isOver40: false });
    expect(r300.takeHomeRate).toBeGreaterThan(r700.takeHomeRate);
    expect(Math.round(r300.takeHomeRate * 1000)).toBe(801); // 約80.1%
    expect(Math.round(r700.takeHomeRate * 1000)).toBe(758); // 約75.8%
  });
});

describe("記事 worked example: 手取り月額 vs 年収÷12（tedori-getsugaku-nenshu-12 記事の裏取り）", () => {
  it("年収500万: 手取り月額324,929 は 額面月額416,667 より小さい", () => {
    const r = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
    expect(r.takeHomeMonthly).toBe(324_929);
    expect(Math.round(5_000_000 / 12)).toBe(416_667);
    expect(r.takeHomeMonthly).toBeLessThan(Math.round(5_000_000 / 12));
  });
  it("年収400万: 手取り月額263,762 vs 額面月額333,333", () => {
    const r = calculateNetSalary({ annualIncome: 4_000_000, isOver40: false });
    expect(r.takeHomeMonthly).toBe(263_762);
    expect(Math.round(4_000_000 / 12)).toBe(333_333);
  });
});
