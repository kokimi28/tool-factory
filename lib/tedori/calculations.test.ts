import { describe, it, expect } from "vitest";
import {
  salaryIncomeDeduction,
  basicDeductionIncomeTax,
  incomeTaxByBracket,
  socialInsurance,
  calculateNetSalary,
} from "./calculations";
import { getAllArticles } from "./articles";

describe("QC6 境界値網羅（tedori・0/負/最低保障/介護保険）", () => {
  // auto-backlog Tier C QC6: 金経路の境界値を明示的に固定（既存テスト不変・新規追加のみ）。
  it("給与所得控除は低年収・負でも最低保障65万円", () => {
    expect(salaryIncomeDeduction(1_000_000)).toBe(650_000);
    expect(salaryIncomeDeduction(-5)).toBe(650_000);
  });
  it("所得税は課税所得0/負で0", () => {
    expect(incomeTaxByBracket(0)).toBe(0);
    expect(incomeTaxByBracket(-100)).toBe(0);
  });
  it("年収0/負は全て0・手取り0・手取り率0", () => {
    const r0 = calculateNetSalary({ annualIncome: 0, isOver40: false });
    expect([r0.socialInsurance, r0.takeHome, r0.takeHomeRate]).toEqual([0, 0, 0]);
    expect(calculateNetSalary({ annualIncome: -100, isOver40: false }).takeHome).toBe(0);
  });
  it("40歳以上（介護保険料あり）は同年収でも手取りが少ない", () => {
    const over40 = calculateNetSalary({ annualIncome: 5_000_000, isOver40: true });
    const under40 = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
    expect(over40.nursingInsurance).toBeGreaterThan(0);
    expect(under40.nursingInsurance).toBe(0);
    expect(over40.takeHome).toBeLessThan(under40.takeHome);
  });
});

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
    expect(si.health).toBe(198_000); // 4.95%
    expect(si.nursing).toBe(0);
    expect(si.pension).toBe(366_000); // 9.15%
    expect(si.childCare).toBe(4_600); // 子ども・子育て支援金 0.115%
    expect(si.employment).toBe(20_000); // 0.5%
    expect(si.total).toBe(588_600);
  });
  it("40歳以上は介護保険が加わる", () => {
    const si = socialInsurance(4_000_000, true);
    expect(si.nursing).toBe(Math.round(4_000_000 * 0.0081)); // 32,400
    expect(si.total).toBe(588_600 + si.nursing);
  });
  it("厚生年金は標準報酬月額上限（年780万相当）で頭打ち", () => {
    const hi = socialInsurance(20_000_000, false);
    expect(hi.pension).toBe(Math.round(7_800_000 * 0.0915)); // 713,700 で頭打ち
  });
  it("健康保険・介護保険・子ども子育て支援金は標準報酬月額上限（年1,668万相当）で頭打ち", () => {
    const hi = socialInsurance(20_000_000, true);
    expect(hi.health).toBe(825_660); // min(2,000万, 1,668万) × 4.95% で頭打ち
    expect(hi.nursing).toBe(135_108); // 同上限 × 0.81%
    expect(hi.childCare).toBe(19_182); // 同上限 × 0.115%
    // 雇用保険は上限なし＝全額に率がかかる
    expect(hi.employment).toBe(100_000); // 2,000万 × 0.5%
  });
});

describe("calculateNetSalary — 年収400万・40歳未満（基準ケース）", () => {
  const r = calculateNetSalary({ annualIncome: 4_000_000, isOver40: false });
  it("社会保険料・所得税・住民税・手取り", () => {
    expect(r.socialInsurance).toBe(588_600);
    expect(r.salaryDeduction).toBe(1_240_000);
    expect(r.employmentIncome).toBe(2_760_000);
    expect(r.taxableIncomeForIncomeTax).toBe(1_291_000);
    expect(r.incomeTax).toBe(65_900);
    expect(r.residentTax).toBe(179_100);
    expect(r.totalDeduction).toBe(833_600);
    expect(r.takeHome).toBe(3_166_400);
    expect(r.takeHomeMonthly).toBe(263_867);
  });
});

describe("calculateNetSalary — 年収600万・40歳未満", () => {
  const r = calculateNetSalary({ annualIncome: 6_000_000, isOver40: false });
  it("内訳と手取り", () => {
    expect(r.socialInsurance).toBe(882_900);
    expect(r.employmentIncome).toBe(4_360_000);
    expect(r.incomeTax).toBe(186_000);
    expect(r.residentTax).toBe(309_700);
    expect(r.takeHome).toBe(4_621_400);
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
    // 社会保険料（健保4.95%＋厚年9.15%＋雇用0.5%＋支援金0.115%＝約14.715%）のみ引かれる
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
  it("40歳未満: 社保735,750・手取り3,900,550・月325,046", () => {
    expect(under.socialInsurance).toBe(735_750);
    expect(under.nursingInsurance).toBe(0);
    expect(under.takeHome).toBe(3_900_550);
    expect(under.takeHomeMonthly).toBe(325_046);
  });
  it("40歳以上: 介護40,500・社保776,250・手取り3,868,350・月322,363", () => {
    expect(over.nursingInsurance).toBe(40_500);
    expect(over.socialInsurance).toBe(776_250);
    expect(over.takeHome).toBe(3_868_350);
    expect(over.takeHomeMonthly).toBe(322_363);
  });
  it("差額: 年32,200・月2,683", () => {
    expect(under.takeHome - over.takeHome).toBe(32_200);
    expect(under.takeHomeMonthly - over.takeHomeMonthly).toBe(2_683);
  });
});

describe("記事 worked example: 社会保険料の内訳（shakai-hoken-uchiwake-tedori 記事の裏取り）", () => {
  // 年収500万・扶養なし・40歳未満
  const r = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
  it("内訳: 健保247,500・厚年457,500・支援金5,750・雇用25,000・合計735,750", () => {
    expect(r.healthInsurance).toBe(247_500);
    expect(r.pensionInsurance).toBe(457_500);
    expect(r.childCareSupportLevy).toBe(5_750);
    expect(r.employmentInsurance).toBe(25_000);
    expect(r.socialInsurance).toBe(735_750);
  });
  it("記事で言及する所得税119,300・住民税244,400", () => {
    expect(r.incomeTax).toBe(119_300);
    expect(r.residentTax).toBe(244_400);
  });
});

describe("記事 worked example: 昇給の限界手取り率（shokyu-tedori-fueni-kui 記事の裏取り）", () => {
  // 年収を100万円ずつ上げたときの手取り増分（限界手取り率が下がる）を固定（品質ゲート①）。
  it("+100万の手取り増: 300→400=763,250 / 400→500=734,150 / 500→600=720,850 / 600→700=683,550 / 700→800=636,250", () => {
    const th = (inc: number) => calculateNetSalary({ annualIncome: inc, isOver40: false }).takeHome;
    expect(th(4_000_000) - th(3_000_000)).toBe(763_250);
    expect(th(5_000_000) - th(4_000_000)).toBe(734_150);
    expect(th(6_000_000) - th(5_000_000)).toBe(720_850);
    expect(th(7_000_000) - th(6_000_000)).toBe(683_550);
    expect(th(8_000_000) - th(7_000_000)).toBe(636_250);
    // 限界手取り率は逓減する（記事の主張）
    expect(th(4_000_000) - th(3_000_000)).toBeGreaterThan(th(8_000_000) - th(7_000_000));
  });
});

describe("記事 worked example: 手取りから年収逆算の早見表（tedori-kara-nenshu-gyakusan 記事の裏取り）", () => {
  // 会社員・扶養なし・40歳未満の年収→手取り（記事の早見表の各行）
  const table: Array<[number, number, number]> = [
    // [annualIncome, takeHome, takeHomeMonthly]
    [3_000_000, 2_403_150, 200_263],
    [4_000_000, 3_166_400, 263_867],
    [5_000_000, 3_900_550, 325_046],
    [6_000_000, 4_621_400, 385_117],
    [7_000_000, 5_304_950, 442_079],
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
  it("年収500万: 手取り月額325,046 は 額面月額416,667 より小さい", () => {
    const r = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
    expect(r.takeHomeMonthly).toBe(325_046);
    expect(Math.round(5_000_000 / 12)).toBe(416_667);
    expect(r.takeHomeMonthly).toBeLessThan(Math.round(5_000_000 / 12));
  });
  it("年収400万: 手取り月額263,867 vs 額面月額333,333", () => {
    const r = calculateNetSalary({ annualIncome: 4_000_000, isOver40: false });
    expect(r.takeHomeMonthly).toBe(263_867);
    expect(Math.round(4_000_000 / 12)).toBe(333_333);
  });
});

describe("記事 gakumen-tedori-hayamihyo（MB5・早見表）の数値二重化", () => {
  // auto-backlog Tier B MB5: 記事本文の早見表の各手取り額を calc 出力で固定する
  //（§品質ゲート①：誤値は CI で赤）。前提は会社員・扶養なし・40歳未満。
  const rows: Array<[number, number]> = [
    [2_000_000, 1_637_400],
    [3_000_000, 2_403_150],
    [4_000_000, 3_166_400],
    [5_000_000, 3_900_550],
    [6_000_000, 4_621_400],
    [7_000_000, 5_304_950],
    [8_000_000, 5_941_200],
    [10_000_000, 7_260_600],
    [12_000_000, 8_539_800],
    [15_000_000, 10_228_150],
  ];
  for (const [income, takeHome] of rows) {
    it(`年収${income / 10_000}万の手取りは ${takeHome}円`, () => {
      const r = calculateNetSalary({ annualIncome: income, isOver40: false });
      expect(r.takeHome).toBe(takeHome);
    });
  }

  it("年収500万の内訳（社保735,750 / 所得税119,300 / 住民税244,400）", () => {
    const r = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
    expect(r.socialInsurance).toBe(735_750);
    expect(r.incomeTax).toBe(119_300);
    expect(r.residentTax).toBe(244_400);
  });

  it("年収500万・40歳以上は介護保険40,500で手取り3,868,350（40歳未満より約3.2万円減）", () => {
    const r = calculateNetSalary({ annualIncome: 5_000_000, isOver40: true });
    expect(r.nursingInsurance).toBe(40_500);
    expect(r.takeHome).toBe(3_868_350);
  });
});

describe("E4 計算の内訳（詳しく）の中間値の整合", () => {
  // 2巡目 Tier E4: ResultDisplay の展開表示が使う calc 中間値の関係を固定。
  // 給与所得 = 額面 − 給与所得控除、課税所得 ≤ 給与所得、各中間値は非負。
  for (const income of [3_000_000, 5_000_000, 8_000_000, 12_000_000]) {
    it(`年収${income / 10_000}万: 給与所得=額面−給与所得控除・課税所得≤給与所得`, () => {
      const r = calculateNetSalary({ annualIncome: income, isOver40: false });
      expect(r.employmentIncome).toBe(income - r.salaryDeduction);
      expect(r.taxableIncomeForIncomeTax).toBeLessThanOrEqual(r.employmentIncome);
      expect(r.salaryDeduction).toBeGreaterThanOrEqual(0);
      expect(r.employmentIncome).toBeGreaterThanOrEqual(0);
      expect(r.taxableIncomeForIncomeTax).toBeGreaterThanOrEqual(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────
//  給与側の記事本文 scenario lock
//
//  既存の worked example describe は「calc の出力」を固定するが、記事本文が
//  その出力からずれても・入力の表記だけが書き換わっても検出できない。
//  ここでは記事の1文（入力＝年収／年齢と、出力＝手取り・率）を **1つの連続した
//  部分文字列** として照合する。数値が本文のどこかに出ていれば通る、という
//  presence-anywhere の穴を塞ぐのが目的。
//
//  Defect 3 の再発防止も兼ねる: tedori-meyasu-nenshu は同じ年収に対して
//  兄弟記事と 1.6万〜2.1万円ずれた丸め値（約315万／約460万）を載せていた。
//  丸め表記も同じ takeHome から生成するので、片方だけ動かすと赤になる。
// ─────────────────────────────────────────────────────────────
describe("記事本文の scenario lock（給与側・入力と出力を1つの連続文字列で固定）", () => {
  const bodyOf = (slug: string) => {
    const a = getAllArticles().find((x) => x.slug === slug);
    expect(a, `記事 ${slug} が無い`).toBeDefined();
    return [
      a!.description,
      ...a!.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
    ].join("\n");
  };
  const yen = (n: number) => `${n.toLocaleString("en-US")}円`;
  /** 「約317万円」— 万円単位の四捨五入 */
  const man = (n: number) => `${Math.round(n / 10_000)}万円`;
  /** 「約316.6万円」— 0.1万円単位の四捨五入 */
  const man1 = (n: number) => `${(Math.round(n / 1000) / 10).toFixed(1)}万円`;
  /** 「78.0%」— 小数第1位までの手取り率 */
  const pct1 = (r: { takeHomeRate: number }) =>
    `${(Math.round(r.takeHomeRate * 1000) / 10).toFixed(1)}%`;
  /** 「およそ79%」— 整数%の手取り率 */
  const pct0 = (r: { takeHomeRate: number }) => `${Math.round(r.takeHomeRate * 100)}%`;
  const salary = (income: number, isOver40 = false) =>
    calculateNetSalary({ annualIncome: income, isOver40 });

  it("tedori-meyasu-nenshu §手取りの目安（丸め表記は takeHome から生成する）", () => {
    const body = bodyOf("tedori-meyasu-nenshu");
    for (const income of [3_000_000, 4_000_000, 5_000_000, 6_000_000]) {
      const r = salary(income);
      expect(
        body,
        `年収${income / 10_000}万円の行が計算結果と一致しない`,
      ).toContain(
        `年収${income / 10_000}万円：手取り 約${man(r.takeHome)}前後（手取り率およそ${pct0(r)}）。`,
      );
    }
  });

  it("tedori-meyasu-nenshu と兄弟記事が同じ年収に同じ手取りを載せている（Defect 3）", () => {
    // 丸め表記（約317万円）と確定値（3,166,400円）は同じ takeHome から作る。
    // どちらか片方だけを書き換えると、この照合が作れなくなって赤になる。
    const meyasu = bodyOf("tedori-meyasu-nenshu");
    const gyakusan = bodyOf("tedori-kara-nenshu-gyakusan");
    const hayamihyo = bodyOf("gakumen-tedori-hayamihyo");
    for (const income of [3_000_000, 4_000_000, 5_000_000, 6_000_000]) {
      const r = salary(income);
      expect(meyasu).toContain(`約${man(r.takeHome)}前後`);
      expect(gyakusan).toContain(
        `年収${income / 10_000}万円 → 手取り 約${man(r.takeHome)}（${yen(r.takeHome)}・月約${yen(r.takeHomeMonthly)}）`,
      );
      expect(hayamihyo).toContain(
        `年収${income / 10_000}万円：手取り ${yen(r.takeHome)}（約${man1(r.takeHome)}・手取り率${pct1(r)}）`,
      );
    }
  });

  it("tedori-kara-nenshu-gyakusan §早見（年収700万まで）と手取り率の低下", () => {
    const body = bodyOf("tedori-kara-nenshu-gyakusan");
    for (const income of [3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000]) {
      const r = salary(income);
      expect(body).toContain(
        `年収${income / 10_000}万円 → 手取り 約${man(r.takeHome)}（${yen(r.takeHome)}・月約${yen(r.takeHomeMonthly)}）`,
      );
    }
    expect(body).toContain(
      `手取り率は年収${3_000_000 / 10_000}万円で約${pct0(salary(3_000_000))}、${7_000_000 / 10_000}万円で約${pct0(salary(7_000_000))}とゆるやかに低下しています。`,
    );
  });

  it("gakumen-tedori-hayamihyo §早見表の全10行（年収と手取り・手取り率が1行で結びつく）", () => {
    const body = bodyOf("gakumen-tedori-hayamihyo");
    for (const income of [
      2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 10_000_000,
      12_000_000, 15_000_000,
    ]) {
      const r = salary(income);
      expect(body, `年収${income / 10_000}万円の行が計算結果と一致しない`).toContain(
        `年収${income / 10_000}万円：手取り ${yen(r.takeHome)}（約${man1(r.takeHome)}・手取り率${pct1(r)}）`,
      );
    }
  });

  it("gakumen-tedori-hayamihyo §内訳の例（年収500万）と社会保険料の対年収比", () => {
    const income = 5_000_000;
    const r = salary(income);
    const siPct = `${(Math.round((r.socialInsurance / income) * 1000) / 10).toFixed(1)}%`;
    const body = bodyOf("gakumen-tedori-hayamihyo");
    expect(body).toContain(
      `年収${income / 10_000}万円（額面）のケースでは、社会保険料が${yen(r.socialInsurance)}、所得税が${yen(r.incomeTax)}、住民税が${yen(r.residentTax)}で、差し引いた手取りは${yen(r.takeHome)}（手取り率${pct1(r)}）です。差し引かれる合計のうち最も大きいのは社会保険料で、額面の約${siPct}を占めます。`,
    );
    // 「最も大きいのは社会保険料」が計算結果として本当であること
    expect(r.socialInsurance).toBeGreaterThan(r.incomeTax + r.residentTax);
  });

  it("gakumen-tedori-hayamihyo §手取り率の低下と40歳以上の差", () => {
    const body = bodyOf("gakumen-tedori-hayamihyo");
    expect(body).toContain(
      `手取り率は年収${2_000_000 / 10_000}万円で約${pct1(salary(2_000_000))}、${5_000_000 / 10_000}万円で${pct1(salary(5_000_000))}、${10_000_000 / 10_000}万円で${pct1(salary(10_000_000))}、${15_000_000 / 10_000}万円で${pct1(salary(15_000_000))}と、額面が増えるほど下がっていきます。`,
    );
    const under = salary(5_000_000);
    const over = salary(5_000_000, true);
    const diffMan1 = (Math.round((under.takeHome - over.takeHome) / 1000) / 10).toFixed(1);
    expect(body).toContain(
      `たとえば年収${5_000_000 / 10_000}万円・40歳以上では介護保険料が${yen(over.nursingInsurance)}かかり、手取りは${yen(over.takeHome)}と、40歳未満より約${diffMan1}万円少なくなります。`,
    );
  });

  it("kaigo-hoken-40sai-tedori §年収500万の40歳前後の比較（1文ずつ入力と出力が結びつく）", () => {
    const body = bodyOf("kaigo-hoken-40sai-tedori");
    const under = salary(5_000_000);
    const over = salary(5_000_000, true);
    expect(body).toContain(
      `40歳未満：社会保険料 ${yen(under.socialInsurance)}、手取り ${yen(under.takeHome)}（月あたり約${yen(under.takeHomeMonthly)}・手取り率 約${pct1(under)}）。`,
    );
    expect(body).toContain(
      `40歳以上：介護保険料 ${yen(over.nursingInsurance)}が加わって社会保険料 ${yen(over.socialInsurance)}、手取り ${yen(over.takeHome)}（月あたり約${yen(over.takeHomeMonthly)}・手取り率 約${pct1(over)}）。`,
    );
    expect(body).toContain(
      `差額は年間${yen(under.takeHome - over.takeHome)}、月あたり約${yen(under.takeHomeMonthly - over.takeHomeMonthly)}です。`,
    );
  });

  it("shakai-hoken-uchiwake-tedori §年収500万の内訳（各項目と対年収比が1文で結びつく）", () => {
    const income = 5_000_000;
    const r = salary(income);
    const siPct = `${(Math.round((r.socialInsurance / income) * 1000) / 10).toFixed(1)}%`;
    const body = bodyOf("shakai-hoken-uchiwake-tedori");
    expect(body).toContain(
      `健康保険 ${yen(r.healthInsurance)}、厚生年金 ${yen(r.pensionInsurance)}、子ども・子育て支援金 ${yen(r.childCareSupportLevy)}、雇用保険 ${yen(r.employmentInsurance)}で、合計 ${yen(r.socialInsurance)}。年収に対しておよそ${siPct}になります。`,
    );
    expect(body).toContain(
      `この後にかかる所得税（この例で${yen(r.incomeTax)}）・住民税（同${yen(r.residentTax)}）はその分軽くなります。`,
    );
    // 「厚生年金が最も大きく、社会保険料全体の6割以上」が計算結果として本当であること
    expect(r.pensionInsurance / r.socialInsurance).toBeGreaterThan(0.6);
  });

  it("tedori-getsugaku-nenshu-12 §年収500万・400万の額面月収と手取り月額", () => {
    const body = bodyOf("tedori-getsugaku-nenshu-12");
    const r5 = salary(5_000_000);
    const gross5 = Math.round(5_000_000 / 12);
    const gapMan5 = Math.round((gross5 - r5.takeHomeMonthly) / 10_000);
    expect(body).toContain(
      `年収${5_000_000 / 10_000}万円・扶養なし・40歳未満の会社員を当サイトの計算ロジックで求めると、手取りは年間${yen(r5.takeHome)}、月あたり約${yen(r5.takeHomeMonthly)}です。一方で年収を12で割った額面月収は約${yen(gross5)}。毎月およそ${gapMan5}万円の差があり、`,
    );
    const r4 = salary(4_000_000);
    expect(body).toContain(
      `年収${4_000_000 / 10_000}万円でも、額面月収 約${yen(Math.round(4_000_000 / 12))}に対して手取り月額は約${yen(r4.takeHomeMonthly)}。`,
    );
  });

  it("shokyu-tedori-fueni-kui §限界手取り率（増分と割合が1文で結びつく）", () => {
    const body = bodyOf("shokyu-tedori-fueni-kui");
    const STEP = 1_000_000;
    const gain = (from: number) => salary(from + STEP).takeHome - salary(from).takeHome;
    const marginal = (from: number) => `${Math.round((gain(from) / STEP) * 100)}%`;
    expect(body).toContain(
      `年収${3_000_000 / 10_000}→${4_000_000 / 10_000}万円では手取りが約${yen(gain(3_000_000))}増え、増額${STEP / 10_000}万円のうち約${marginal(3_000_000)}が手取りになります。`,
    );
    expect(body).toContain(
      `年収${4_000_000 / 10_000}→${5_000_000 / 10_000}万円では約${yen(gain(4_000_000))}（約${marginal(4_000_000)}）、${5_000_000 / 10_000}→${6_000_000 / 10_000}万円では約${yen(gain(5_000_000))}（約${marginal(5_000_000)}）、${6_000_000 / 10_000}→${7_000_000 / 10_000}万円では約${yen(gain(6_000_000))}（約${marginal(6_000_000)}）、${7_000_000 / 10_000}→${8_000_000 / 10_000}万円では約${yen(gain(7_000_000))}（約${marginal(7_000_000)}）。`,
    );
  });
});
