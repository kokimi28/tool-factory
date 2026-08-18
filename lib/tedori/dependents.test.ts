/**
 * 扶養控除・特定親族特別控除（G1）のテスト。
 *
 * テストの役目:
 *  ① 公表されている控除額の表を再現できるか（所得税・住民税で満額の範囲も額も違う）
 *  ② 年齢区分の境目（16/19/23/70歳）
 *  ③ 特定親族特別控除の逓減（10万円刻み・乗数2。配偶者特別控除の5万円刻みと違う）
 *  ④ 給与収入で言った壁が合計所得と給与所得控除から導出されているか
 *  ⑤ 記事2本の数値が実装と一致しているか
 *
 * ③が重要な理由: 配偶者特別控除（83条の2）と特定親族特別控除（84条の2）は
 * 似た形の逓減式だが、乗数（なし／2倍）も刻み（5万円／10万円）も違う。
 * 片方の実装を使い回すと静かに誤る。
 */
import { describe, expect, it } from 'vitest';

import { getArticle } from './articles';
import { calculateNetSalary, salaryIncomeDeduction } from './calculations';
import {
  DEPENDENT_DEDUCTION,
  DEPENDENT_INCOME_LIMIT,
  dependentDeduction,
  dependentKindByAge,
  dependentWallsBySalary,
  familyDeduction,
} from './dependents';
import { spouseDeduction } from '../nenshu-kabe/spouse-deduction';

const PARENT = 6_000_000; // 記事の標準例（親・扶養する側の年収）
const parentIncome = PARENT - salaryIncomeDeduction(PARENT);
const netAt = (personalDeduction: { incomeTax: number; residentTax: number }) =>
  calculateNetSalary({ annualIncome: PARENT, isOver40: false, personalDeduction });

describe('年齢区分（所得税法2条1項34号の2〜34号の4）', () => {
  it('16歳未満は対象外・19〜22歳は特定・70歳以上は老人', () => {
    expect(dependentKindByAge(15)).toBe('underSixteen');
    expect(dependentKindByAge(16)).toBe('general');
    expect(dependentKindByAge(18)).toBe('general');
    expect(dependentKindByAge(19)).toBe('specific');
    expect(dependentKindByAge(22)).toBe('specific');
    expect(dependentKindByAge(23)).toBe('general');
    expect(dependentKindByAge(69)).toBe('general');
    expect(dependentKindByAge(70)).toBe('elderly');
  });

  it('16歳未満は控除0（児童手当の対象なので扶養控除がない）', () => {
    expect(dependentDeduction(10)).toMatchObject({ incomeTax: 0, residentTax: 0, kind: 'none' });
  });

  it('区分ごとの額（所得税 38/63/48万円・住民税 33/45/38万円）', () => {
    expect(dependentDeduction(16)).toMatchObject({ incomeTax: 380_000, residentTax: 330_000 });
    expect(dependentDeduction(19)).toMatchObject({ incomeTax: 630_000, residentTax: 450_000 });
    expect(dependentDeduction(70)).toMatchObject({ incomeTax: 480_000, residentTax: 380_000 });
    expect(DEPENDENT_DEDUCTION.incomeTax.specific).toBe(630_000);
    expect(DEPENDENT_DEDUCTION.residentTax.specific).toBe(450_000);
  });
});

describe('扶養親族になれる所得の上限', () => {
  it('合計所得58万円以下（改正前の48万円ではない）', () => {
    expect(DEPENDENT_INCOME_LIMIT).toBe(580_000);
    expect(dependentDeduction(16, 580_000).kind).toBe('dependentDeduction');
    expect(dependentDeduction(16, 580_001).kind).toBe('none');
  });

  it('58万円を超えても、19〜22歳だけは特定親族特別控除に引き継がれる', () => {
    expect(dependentDeduction(19, 580_001).kind).toBe('specificRelative');
    expect(dependentDeduction(18, 580_001).kind).toBe('none');
    expect(dependentDeduction(23, 580_001).kind).toBe('none');
    expect(dependentDeduction(70, 580_001).kind).toBe('none');
  });
});

describe('特定親族特別控除の表を再現する（所得税法84条の2）', () => {
  const at = (income: number) => dependentDeduction(20, income);

  it('所得税の段階（85/90/95/…/123万円）', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [850_000, 630_000], [900_000, 610_000], [950_000, 510_000], [1_000_000, 410_000],
      [1_050_000, 310_000], [1_100_000, 210_000], [1_150_000, 110_000], [1_200_000, 60_000],
      [1_230_000, 30_000],
    ];
    for (const [income, expected] of table) expect(at(income).incomeTax).toBe(expected);
  });

  it('住民税は満額の範囲が95万円まで・額は45万円（所得税と違う）', () => {
    expect(at(850_000).residentTax).toBe(450_000);
    expect(at(950_000).residentTax).toBe(450_000);
    expect(at(950_000).incomeTax).toBe(510_000); // 所得税はもう減っている
    expect(at(1_000_000).residentTax).toBe(410_000);
  });

  it('123万円を超えると適用なし', () => {
    expect(at(1_230_000).kind).toBe('specificRelative');
    expect(at(1_230_001).kind).toBe('none');
  });

  it('逓減は10万円刻み（配偶者特別控除の5万円刻みと混同していない）', () => {
    // 85万円を1円超えるごとに 2万・12万・22万… と落ちる＝隣り合う段の差は10万円
    const steps = [900_000, 1_000_000, 1_100_000].map((i) => at(i).incomeTax);
    expect(steps[0]! - steps[1]!).toBe(200_000); // 90万→100万 で2段
    expect(steps[1]! - steps[2]!).toBe(200_000);
  });
});

describe('給与収入で言った壁は導出されている', () => {
  const walls = dependentWallsBySalary();

  it('扶養123万円・満額150万円・上限188万円', () => {
    expect(walls.dependentLimit).toBe(1_230_000);
    expect(walls.specificFullLimit).toBe(1_500_000);
    expect(walls.specificMaxLimit).toBe(1_880_000);
  });

  it('改正前の103万円を現行として持っていない', () => {
    expect(walls.dependentLimit).not.toBe(1_030_000);
  });

  it('壁の直前まで満額、直後から減る', () => {
    const dedAt = (salary: number) =>
      dependentDeduction(20, Math.max(0, salary - salaryIncomeDeduction(salary))).incomeTax;
    expect(dedAt(walls.specificFullLimit)).toBe(630_000);
    expect(dedAt(walls.specificFullLimit + 100_000)).toBeLessThan(630_000);
    expect(dedAt(walls.specificMaxLimit)).toBeGreaterThan(0);
    expect(dedAt(walls.specificMaxLimit + 20_000)).toBe(0);
  });
});

describe('familyDeduction は人数ぶん積み上がる', () => {
  it('複数人の合計になる', () => {
    expect(familyDeduction([{ age: 19 }, { age: 70 }])).toEqual({
      incomeTax: 630_000 + 480_000,
      residentTax: 450_000 + 380_000,
    });
  });

  it('16歳未満を混ぜても増えない', () => {
    expect(familyDeduction([{ age: 16 }, { age: 10 }])).toEqual(familyDeduction([{ age: 16 }]));
  });

  it('空配列は0', () => {
    expect(familyDeduction()).toEqual({ incomeTax: 0, residentTax: 0 });
  });
});

describe('calculateNetSalary の personalDeduction は後方互換', () => {
  it('渡さないときは従来どおり（扶養なし）', () => {
    const a = calculateNetSalary({ annualIncome: PARENT, isOver40: false });
    const b = calculateNetSalary({ annualIncome: PARENT, isOver40: false, personalDeduction: {} });
    expect(a.takeHome).toBe(b.takeHome);
  });

  it('控除を渡すと所得税・住民税が下がり手取りが増える', () => {
    const none = calculateNetSalary({ annualIncome: PARENT, isOver40: false });
    const withDed = netAt({ incomeTax: 630_000, residentTax: 450_000 });
    expect(withDed.incomeTax).toBeLessThan(none.incomeTax);
    expect(withDed.residentTax).toBeLessThan(none.residentTax);
    expect(withDed.takeHome).toBeGreaterThan(none.takeHome);
  });
});

describe('記事 tedori-kazoku-kousei（G1）の数値が実装と一致している', () => {
  const article = getArticle('tedori-kazoku-kousei')!;
  const body = [article.title, article.description, ...article.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs])].join('\n');
  const yen = (n: number): string => n.toLocaleString('en-US');
  const sp = spouseDeduction(0, parentIncome);
  const withFamily = (members: Parameters<typeof familyDeduction>[0]) => {
    const f = familyDeduction(members);
    return netAt({ incomeTax: sp.incomeTax + f.incomeTax, residentTax: sp.residentTax + f.residentTax });
  };
  const single = calculateNetSalary({ annualIncome: PARENT, isOver40: false });

  it('家族構成別の手取りを、独身との差つきで載せている', () => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ['配偶者あり（収入なし）', netAt(sp).takeHome],
      ['配偶者＋子16歳', withFamily([{ age: 16 }]).takeHome],
      ['配偶者＋子19歳', withFamily([{ age: 19 }]).takeHome],
      ['配偶者＋子19歳＋70歳の親', withFamily([{ age: 19 }, { age: 70 }]).takeHome],
    ];
    expect(body).toContain(`独身：手取り ${yen(single.takeHome)}円`);
    for (const [label, take] of cases) {
      expect(body).toContain(`${label}：手取り ${yen(take)}円（+${yen(take - single.takeHome)}円）`);
    }
  });

  it('16歳未満で手取りが増えないことを、配偶者のみと同額だと示している', () => {
    const child10 = withFamily([{ age: 10 }]).takeHome;
    expect(child10).toBe(netAt(sp).takeHome); // 前提が崩れたら本文も直す
    expect(body).toContain(`配偶者＋子10歳の世帯の手取りは${yen(child10)}円で、配偶者のみの世帯とまったく同じです`);
  });

  it('特定扶養親族による差額を実額で載せている', () => {
    const diff = withFamily([{ age: 19 }]).takeHome - withFamily([{ age: 16 }]).takeHome;
    expect(body).toContain(`子16歳と子19歳の差（${yen(diff)}円）`);
  });

  it('扶養に入れる上限を給与収入で載せている', () => {
    expect(body).toContain(`給与収入に直すと${yen(dependentWallsBySalary().dependentLimit)}円までです`);
  });

  it('本文に出るすべての「◯円」が実装の値と一致する', () => {
    const allowed = new Set<string>([yen(single.takeHome), yen(dependentWallsBySalary().dependentLimit)]);
    for (const members of [[], [{ age: 16 }], [{ age: 19 }], [{ age: 10 }], [{ age: 19 }, { age: 70 }]]) {
      const t = withFamily(members).takeHome;
      allowed.add(yen(t));
      allowed.add(yen(t - single.takeHome));
    }
    allowed.add(yen(withFamily([{ age: 19 }]).takeHome - withFamily([{ age: 16 }]).takeHome));
    const found = [...body.matchAll(/\d{1,3}(?:,\d{3})+(?=円)/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(8);
    for (const f of found) expect([...allowed]).toContain(f);
  });
});

describe('記事 daigakusei-baito-oya-tedori（G1）の数値が実装と一致している', () => {
  const article = getArticle('daigakusei-baito-oya-tedori')!;
  const body = [article.title, article.description, ...article.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs])].join('\n');
  const yen = (n: number): string => n.toLocaleString('en-US');
  const walls = dependentWallsBySalary();
  const parentNetAtChildSalary = (childSalary: number) => {
    const childIncome = Math.max(0, childSalary - salaryIncomeDeduction(childSalary));
    const d = dependentDeduction(19, childIncome);
    return netAt({ incomeTax: d.incomeTax, residentTax: d.residentTax }).takeHome;
  };
  const full = parentNetAtChildSalary(walls.dependentLimit);

  it('三段の壁を給与収入で載せている', () => {
    expect(body).toContain(`子の年収${yen(walls.dependentLimit)}円まで：扶養控除`);
    expect(body).toContain(`子の年収${yen(walls.specificFullLimit)}円まで：特定親族特別控除で満額63万円を維持`);
    expect(body).toContain(`子の年収${yen(walls.specificMaxLimit)}円まで：段階的に減少`);
  });

  it('親の手取りの減り方を実額で載せている', () => {
    expect(body).toContain(`基準は控除が満額のときの${yen(full)}円です`);
    for (const cs of [1_500_000, 1_600_000, 1_700_000, 1_880_000]) {
      const t = parentNetAtChildSalary(cs);
      const drop = full - t;
      const suffix = drop === 0 ? '（減少 0円）' : `（${yen(drop)}円減）`;
      expect(body).toContain(`子の年収${yen(cs)}円：親の手取り ${yen(t)}円${suffix}`);
    }
  });

  it('控除が完全になくなったあとの頭打ちを載せている', () => {
    const cap = full - parentNetAtChildSalary(2_000_000);
    expect(body).toContain(`控除がなくなったあとは${yen(cap)}円減で頭打ち`);
  });

  it('満額の範囲が所得税と住民税で違うことを明記している', () => {
    expect(body).toContain('所得税は子の合計所得金額85万円以下で63万円、住民税は95万円以下で45万円です');
  });

  it('103万円は改正前の値として扱っている', () => {
    const units = [article.description, ...article.sections.flatMap((s) => s.paragraphs)];
    for (const u of units.filter((x) => x.includes('103万'))) expect(u).toMatch(/改正|かつて|以前|過去/);
  });

  it('本文に出るすべての「◯円」が実装の値と一致する', () => {
    const allowed = new Set<string>([
      yen(walls.dependentLimit), yen(walls.specificFullLimit), yen(walls.specificMaxLimit),
      yen(full), yen(full - parentNetAtChildSalary(2_000_000)),
    ]);
    for (const cs of [1_500_000, 1_600_000, 1_700_000, 1_880_000]) {
      allowed.add(yen(cs));
      allowed.add(yen(parentNetAtChildSalary(cs)));
      allowed.add(yen(full - parentNetAtChildSalary(cs)));
    }
    const found = [...body.matchAll(/\d{1,3}(?:,\d{3})+(?=円)/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(10);
    for (const f of found) expect([...allowed]).toContain(f);
  });
});
