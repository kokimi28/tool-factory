/**
 * 配偶者控除・配偶者特別控除（G6）のテスト。
 *
 * この表は条文の写しなので、テストの役目は
 *  ① 公表されている控除額の表を再現できるか（所得税・住民税は満額の範囲が違う）
 *  ② 逓減の階段（5万円刻み）の境目
 *  ③ 納税者の所得による按分（2/3・1/3・1万円未満切上げ）
 *  ④ 給与収入で言った壁が、合計所得と給与所得控除から導出されているか
 *  ⑤ 世帯合計で見たときの向き（どこで下がり、どこで下がらないか）
 *  ⑥ 記事の数値が実装と一致しているか
 *
 * ④が重要な理由: 壁は法律上すべて合計所得金額で定義され、給与収入の額は
 * 給与所得控除を通じた従属値でしかない。従来の記事は 103万・150万・201.6万 を
 * 直書きしていたため、令和7年度改正で給与所得控除と各しきい値が動いた結果、
 * 3つとも古い値のまま published されていた。
 */
import { describe, expect, it } from 'vitest';

import { salaryIncomeDeduction } from '../tedori/calculations';
import { getArticle } from './articles';
import {
  SPOUSE_INCOME_THRESHOLDS,
  filerTaxWithSpouse,
  householdImpact,
  salaryForTotalIncome,
  spouseDeduction,
  spouseWallsBySalary,
} from './spouse-deduction';

const FILER = 5_000_000; // 記事の標準例（扶養する側の年収）

describe('公表されている控除額の表を再現する（納税者の合計所得900万円以下）', () => {
  const it_ = (spouseTotalIncome: number) => spouseDeduction(spouseTotalIncome, 5_000_000);

  it('配偶者控除: 合計所得58万円以下で 所得税38万円・住民税33万円', () => {
    expect(it_(580_000)).toMatchObject({ incomeTax: 380_000, residentTax: 330_000, kind: 'spouseDeduction' });
    expect(it_(0).kind).toBe('spouseDeduction');
  });

  it('配偶者特別控除・所得税の段階（95/100/105/…/133万円）', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [950_000, 380_000], [1_000_000, 360_000], [1_050_000, 310_000], [1_100_000, 260_000],
      [1_150_000, 210_000], [1_200_000, 160_000], [1_250_000, 110_000], [1_300_000, 60_000],
      [1_330_000, 30_000],
    ];
    for (const [income, expected] of table) expect(it_(income).incomeTax).toBe(expected);
  });

  it('配偶者特別控除・住民税は満額の範囲が100万円まで（所得税の95万円と違う）', () => {
    expect(it_(950_000).residentTax).toBe(330_000);
    expect(it_(1_000_000).residentTax).toBe(330_000); // 所得税は36万円に落ちている
    expect(it_(1_000_000).incomeTax).toBe(360_000);
    expect(it_(1_000_001).residentTax).toBe(310_000);
  });

  it('133万円を超えると適用なし', () => {
    expect(it_(1_330_000).kind).toBe('specialDeduction');
    expect(it_(1_330_001)).toMatchObject({ incomeTax: 0, residentTax: 0, kind: 'none' });
  });

  it('納税者の合計所得が1,000万円を超えるとどちらも使えない', () => {
    expect(spouseDeduction(500_000, 10_000_001).kind).toBe('none');
    expect(spouseDeduction(1_000_000, 10_000_001).kind).toBe('none');
  });
});

describe('逓減の階段（5万円刻み）の境目', () => {
  it('段の切り替わりは「◯万円ちょうど」と「＋1円」で変わる', () => {
    for (const boundary of [1_000_000, 1_050_000, 1_100_000, 1_150_000, 1_200_000, 1_250_000, 1_300_000]) {
      const before = spouseDeduction(boundary, FILER).incomeTax;
      const after = spouseDeduction(boundary + 1, FILER).incomeTax;
      expect(after).toBeLessThan(before);
    }
  });

  it('控除額は配偶者の所得が増えるほど単調に減る', () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let inc = 580_000; inc <= 1_400_000; inc += 10_000) {
      const v = spouseDeduction(inc, FILER).incomeTax;
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('納税者の所得による按分（2/3・1/3・1万円未満切上げ）', () => {
  it('配偶者控除は 38/26/13 万円（住民税 33/22/11 万円）', () => {
    for (const [filer, it_, rt] of [[9_000_000, 380_000, 330_000], [9_500_000, 260_000, 220_000], [10_000_000, 130_000, 110_000]] as const) {
      const r = spouseDeduction(500_000, filer);
      expect([r.incomeTax, r.residentTax]).toEqual([it_, rt]);
    }
  });

  it('配偶者特別控除は 2/3・1/3 して1万円未満を切り上げる', () => {
    // 38万円 × 2/3 ＝ 253,333… → 26万円 ／ × 1/3 ＝ 126,666… → 13万円
    expect(spouseDeduction(900_000, 9_500_000).incomeTax).toBe(260_000);
    expect(spouseDeduction(900_000, 10_000_000).incomeTax).toBe(130_000);
    // 住民税 33万円 × 2/3 ＝ 22万円 ／ × 1/3 ＝ 11万円
    expect(spouseDeduction(900_000, 9_500_000).residentTax).toBe(220_000);
    expect(spouseDeduction(900_000, 10_000_000).residentTax).toBe(110_000);
  });
});

describe('給与収入で言った壁は、合計所得と給与所得控除から導出される', () => {
  const walls = spouseWallsBySalary();

  it('salaryForTotalIncome は給与所得控除の逆算になっている', () => {
    for (const target of [580_000, 950_000, 1_330_000]) {
      const salary = salaryForTotalIncome(target);
      expect(salary - salaryIncomeDeduction(salary)).toBeGreaterThanOrEqual(target);
      // 1円下げると届かない＝条件を満たす最小の給与収入
      expect((salary - 1) - salaryIncomeDeduction(salary - 1)).toBeLessThan(target);
    }
  });

  it('現行の壁は 123万円 / 160万円 / 2,014,285円', () => {
    expect(walls.spouseDeductionLimit).toBe(1_230_000);
    expect(walls.specialFullLimit).toBe(1_600_000);
    expect(walls.specialZeroFrom).toBe(2_014_285);
  });

  it('改正前の 103万円・150万円・201.6万円 ではない（直書きしていない証拠）', () => {
    expect(walls.spouseDeductionLimit).not.toBe(1_030_000);
    expect(walls.specialFullLimit).not.toBe(1_500_000);
    expect(walls.specialZeroFrom).not.toBe(2_016_000);
  });

  it('壁の直前まで控除は満額、直後から減る', () => {
    const at = (salary: number) => spouseDeduction(salary - salaryIncomeDeduction(salary), FILER).incomeTax;
    expect(at(walls.specialFullLimit)).toBe(380_000);
    expect(at(walls.specialFullLimit + 10_000)).toBeLessThan(380_000);
    expect(spouseDeduction(
      walls.specialZeroFrom + 10_000 - salaryIncomeDeduction(walls.specialZeroFrom + 10_000), FILER,
    ).kind).toBe('none');
  });
});

describe('世帯合計で見たときの向き', () => {
  it('配偶者の年収が160万円までなら、扶養する側の税は1円も増えない', () => {
    for (const sp of [0, 1_000_000, 1_230_000, 1_300_000, 1_600_000]) {
      expect(householdImpact(FILER, sp).filerTaxIncrease).toBe(0);
    }
  });

  it('160万円を超えると扶養する側の税が増え始め、控除ゼロで頭打ちになる', () => {
    const at201 = householdImpact(FILER, 2_014_285).filerTaxIncrease;
    const at210 = householdImpact(FILER, 2_100_000).filerTaxIncrease;
    const at300 = householdImpact(FILER, 3_000_000).filerTaxIncrease;
    expect(at201).toBeGreaterThan(0);
    expect(at210).toBeGreaterThan(at201);
    expect(at300).toBe(at210); // 控除が0になった後は増えない
  });

  it('配偶者特別控除の壁では世帯の手取りは逆転しない（増え続ける）', () => {
    let prev = -1;
    for (const sp of [1_600_000, 1_700_000, 1_800_000, 1_900_000, 2_014_285, 2_100_000, 2_200_000]) {
      const h = householdImpact(FILER, sp).householdNet;
      expect(h).toBeGreaterThan(prev);
      prev = h;
    }
  });

  it('逆転するのは社会保険の壁（130万円）だけ', () => {
    const before = householdImpact(FILER, 1_230_000).householdNet;
    const after = householdImpact(FILER, 1_300_000).householdNet;
    expect(after).toBeLessThan(before);
  });

  it('扶養する側の年収が高いほど、同じ控除減でも税の増え方が大きい', () => {
    const low = householdImpact(5_000_000, 2_100_000).filerTaxIncrease;
    const high = householdImpact(7_000_000, 2_100_000).filerTaxIncrease;
    expect(high).toBeGreaterThan(low);
  });

  it('異常入力は0として扱う', () => {
    const h = householdImpact(Number.NaN, -1);
    expect(h.filerTax).toBe(0);
    expect(h.filerTaxIncrease).toBe(0);
  });
});

describe('記事 nenshu-kabe-150-201（G6）の数値が実装と一致している', () => {
  const article = getArticle('nenshu-kabe-150-201')!;
  const body = [
    article.title, article.description, article.lead,
    ...article.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs, ...(s.bullets ?? [])]),
    ...(article.faqs ?? []).flatMap((f) => [f.question, f.answer]),
  ].join('\n');
  const yen = (n: number): string => n.toLocaleString('en-US');
  const walls = spouseWallsBySalary();

  it('現行の壁を給与収入で正しく載せている', () => {
    expect(body).toContain(`配偶者特別控除が満額（38万円）から減り始めるのは年収${yen(walls.specialFullLimit)}円`);
    expect(body).toContain(`控除がゼロになるのは年収${yen(walls.specialZeroFrom)}円`);
  });

  it('改正前の値を「現行の壁」として載せていない', () => {
    // 「150万円の壁」は読者の検索語なので言及自体は禁じない。禁じるのは現行として
    // 提示すること。言及する行には必ず改正前だと分かる語が同居していることを確かめる。
    expect(body).not.toContain('150万円：配偶者特別控除');
    expect(body).not.toContain('150万円の壁：');
    // 検査の単位は「行」ではなく意味のまとまり。FAQ は質問文そのものが検索語なので、
    // 質問と回答を1つの単位として見ないと、正しい記事を誤検出する。
    const units = [
      article.title, article.description, article.lead,
      ...article.sections.flatMap((sec) => [...sec.paragraphs, ...(sec.bullets ?? [])]),
      ...(article.faqs ?? []).map((f) => `${f.question}\n${f.answer}`),
    ];
    const stale = units.filter((u) => /150万|201\.6万/.test(u));
    expect(stale.length).toBeGreaterThan(0); // 検索語として残してある
    for (const unit of stale) expect(unit).toMatch(/改正|かつて|以前|旧/);
  });

  it('扶養する側の税の増加を実額で載せている', () => {
    for (const sp of [1_800_000, 2_100_000]) {
      expect(body).toContain(`年収${yen(sp)}円なら${yen(householdImpact(FILER, sp).filerTaxIncrease)}円`);
    }
  });

  it('世帯の手取りが逆転しないことを、逆転する130万円と対比して載せている', () => {
    const drop = householdImpact(FILER, 1_230_000).householdNet - householdImpact(FILER, 1_300_000).householdNet;
    expect(body).toContain(`世帯の手取りが実際に下がるのは130万円の社会保険の壁だけで、その落ち込みは${yen(drop)}円`);
  });

  it('本文に出るすべての「◯円」が実装の値と一致する', () => {
    const allowed = new Set<string>([
      yen(walls.specialFullLimit), yen(walls.specialZeroFrom), yen(walls.spouseDeductionLimit),
      yen(householdImpact(FILER, 1_230_000).householdNet - householdImpact(FILER, 1_300_000).householdNet),
    ]);
    for (const sp of [1_600_000, 1_800_000, 2_014_285, 2_100_000]) {
      const h = householdImpact(FILER, sp);
      allowed.add(yen(sp));
      allowed.add(yen(h.filerTaxIncrease));
      allowed.add(yen(h.spouseNet));
      allowed.add(yen(h.householdNet));
    }
    const found = [...body.matchAll(/\d{1,3}(?:,\d{3})+(?=円)/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(8);
    for (const f of found) expect([...allowed]).toContain(f);
  });

  it('レンダラが解釈しない markdown 記法が残っていない', () => {
    expect(body).not.toContain('**');
  });
});

describe('filerTaxWithSpouse は控除の分だけ税を減らす', () => {
  it('配偶者控除がある場合とない場合で税が変わる', () => {
    const withSpouse = filerTaxWithSpouse(FILER, 0);
    const without = filerTaxWithSpouse(FILER, 5_000_000);
    expect(withSpouse.total).toBeLessThan(without.total);
    expect(withSpouse.deduction.kind).toBe('spouseDeduction');
    expect(without.deduction.kind).toBe('none');
  });
});

describe('記事 nenshu-kabe-haigusha-kojo（G6）の3つのラインが実装と一致している', () => {
  const article = getArticle('nenshu-kabe-haigusha-kojo')!;
  const units = [
    article.title, article.description, article.lead,
    ...article.sections.flatMap((sec) => [...sec.paragraphs, ...(sec.bullets ?? [])]),
    ...(article.faqs ?? []).map((f) => `${f.question}\n${f.answer}`),
  ];
  const body = units.join('\n');
  const yen = (n: number): string => n.toLocaleString('en-US');
  const walls = spouseWallsBySalary();

  it('3つのラインを実装の値で載せている', () => {
    expect(body).toContain(`配偶者の給与収入 ${yen(walls.spouseDeductionLimit)}円以下 → 満額38万円`);
    expect(body).toContain(`${yen(walls.specialFullLimit)}円までは配偶者特別控除でも満額38万円を維持`);
    expect(body).toContain(`${yen(walls.specialZeroFrom)}円で控除は0に`);
  });

  it('タイトルが現行のラインを指している', () => {
    expect(article.title).toContain('123万円・160万円・約201万円');
  });

  it('改正前の値に触れる箇所は必ず改正前だと分かる形になっている', () => {
    const stale = units.filter((u) => /103万|150万|201\.6万/.test(u));
    expect(stale.length).toBeGreaterThan(0);
    for (const unit of stale) expect(unit).toMatch(/改正|かつて|以前|旧/);
  });

  it('所得税と住民税で額も範囲も違うことを明記している', () => {
    expect(body).toContain('所得税は38万円、住民税は33万円と額が違います');
    expect(body).toContain('所得税は配偶者の合計所得金額95万円以下、住民税は100万円以下');
  });
});
