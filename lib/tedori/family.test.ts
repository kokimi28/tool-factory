/**
 * H1: 扶養家族を手取り計算に接続した部分のテスト。
 *
 * 控除額そのものは dependents.test.ts が条文で固定しているので、ここでは
 * 「UI の入力（年齢・年収）を、モデルが受け取る形（年齢・合計所得）に正しく直せているか」と
 * 「その結果が手取りに効いているか」を見る。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { familyImpact, toFamilyMembers, encodeFamily, decodeFamily } from './family';
import { calculateNetSalary, salaryIncomeDeduction } from './calculations';
import { DEPENDENT_DEDUCTION, DEPENDENT_INCOME_LIMIT, dependentWallsBySalary } from './dependents';

const BASE = { annualIncome: 5_000_000, isOver40: false } as const;

describe('年収 → 合計所得の変換', () => {
  it('給与所得控除を引いた額を渡す（年収をそのまま渡さない）', () => {
    const [m] = toFamilyMembers([{ age: 20, annualIncome: 1_500_000 }]);
    expect(m.totalIncome).toBe(1_500_000 - salaryIncomeDeduction(1_500_000));
    expect(m.totalIncome).not.toBe(1_500_000);
  });

  it('扶養控除の上限は「合計所得58万円」であって「年収58万円」ではない', () => {
    const limitSalary = dependentWallsBySalary().dependentLimit;
    const [atLimit] = toFamilyMembers([{ age: 17, annualIncome: limitSalary }]);
    expect(atLimit.totalIncome).toBeLessThanOrEqual(DEPENDENT_INCOME_LIMIT);
    // 上限ちょうどの年収なら控除は満額のまま
    expect(familyImpact(BASE, [{ age: 17, annualIncome: limitSalary }]).deduction.incomeTax).toBe(
      DEPENDENT_DEDUCTION.incomeTax.general,
    );
    // 1万円超えると外れる
    expect(
      familyImpact(BASE, [{ age: 17, annualIncome: limitSalary + 10_000 }]).deduction.incomeTax,
    ).toBe(0);
  });

  it('負値・非数は0として扱う', () => {
    expect(toFamilyMembers([{ age: -5, annualIncome: -100 }])).toEqual([{ age: 0, totalIncome: 0 }]);
  });
});

describe('扶養が手取りに効いている', () => {
  it('16歳未満は控除がなく、手取りは扶養なしと同じ', () => {
    const r = familyImpact(BASE, [{ age: 10, annualIncome: 0 }]);
    expect(r.deduction).toEqual({ incomeTax: 0, residentTax: 0 });
    expect(r.takeHomeGain).toBe(0);
    expect(r.withFamily.takeHome).toBe(calculateNetSalary(BASE).takeHome);
  });

  it.each([
    [17, 'general'],
    [20, 'specific'],
    [72, 'elderly'],
  ] as const)('年齢 %i は %s 区分の控除が入り、手取りが増える', (age, kind) => {
    const r = familyImpact(BASE, [{ age, annualIncome: 0 }]);
    expect(r.deduction.incomeTax).toBe(DEPENDENT_DEDUCTION.incomeTax[kind]);
    expect(r.deduction.residentTax).toBe(DEPENDENT_DEDUCTION.residentTax[kind]);
    expect(r.takeHomeGain).toBeGreaterThan(0);
    expect(r.withFamily.takeHome).toBe(r.withoutFamily.takeHome + r.takeHomeGain);
  });

  it('控除が大きい区分ほど手取りの増え方も大きい', () => {
    const general = familyImpact(BASE, [{ age: 17, annualIncome: 0 }]).takeHomeGain;
    const elderly = familyImpact(BASE, [{ age: 72, annualIncome: 0 }]).takeHomeGain;
    const specific = familyImpact(BASE, [{ age: 20, annualIncome: 0 }]).takeHomeGain;
    expect(general).toBeLessThan(elderly);
    expect(elderly).toBeLessThan(specific);
  });

  it('複数人は合算される', () => {
    const members = [
      { age: 17, annualIncome: 0 },
      { age: 20, annualIncome: 0 },
      { age: 72, annualIncome: 0 },
    ];
    const all = familyImpact(BASE, members);
    const sum = members.reduce((a, m) => a + familyImpact(BASE, [m]).deduction.incomeTax, 0);
    expect(all.deduction.incomeTax).toBe(sum);
    expect(all.takeHomeGain).toBeGreaterThan(
      Math.max(...members.map((m) => familyImpact(BASE, [m]).takeHomeGain)),
    );
  });

  it('扶養なしの結果は従来の calculateNetSalary と一致する（既定の挙動が変わっていない）', () => {
    expect(familyImpact(BASE, []).withFamily).toEqual(calculateNetSalary(BASE));
    expect(familyImpact(BASE).takeHomeGain).toBe(0);
  });

  it('特定親族特別控除の逓減が年収に応じて効く（満額 → 減る → 消える）', () => {
    const walls = dependentWallsBySalary();
    const full = familyImpact(BASE, [{ age: 20, annualIncome: walls.specificFullLimit }]);
    const tapered = familyImpact(BASE, [{ age: 20, annualIncome: walls.specificFullLimit + 200_000 }]);
    const gone = familyImpact(BASE, [{ age: 20, annualIncome: walls.specificMaxLimit + 200_000 }]);
    expect(full.deduction.incomeTax).toBe(DEPENDENT_DEDUCTION.incomeTax.specific);
    expect(tapered.deduction.incomeTax).toBeGreaterThan(0);
    expect(tapered.deduction.incomeTax).toBeLessThan(full.deduction.incomeTax);
    expect(gone.deduction.incomeTax).toBe(0);
  });
});

describe('共有 URL の往復', () => {
  it('encode → decode で同じ入力に戻る', () => {
    const family = [
      { age: 17, annualIncome: 0 },
      { age: 20, annualIncome: 1_500_000 },
    ];
    expect(decodeFamily(encodeFamily(family))).toEqual(family);
  });

  it('空はクエリに出さない', () => {
    expect(encodeFamily([])).toBe('');
    expect(decodeFamily('')).toEqual([]);
    expect(decodeFamily(undefined)).toEqual([]);
  });

  it('壊れた値は落とす（共有 URL は改変されうる）', () => {
    expect(decodeFamily('abc')).toEqual([]);
    expect(decodeFamily('20-1000000_broken_999-0')).toEqual([{ age: 20, annualIncome: 1_000_000 }]);
    expect(decodeFamily('0-0')).toEqual([]);
    // 「2つに割れるが数字でない」形は digit 検査でしか落とせない
    expect(decodeFamily('a-b')).toEqual([]);
    expect(decodeFamily('a-b_20-100')).toEqual([{ age: 20, annualIncome: 100 }]);
    expect(decodeFamily('-1--1')).toEqual([]);
    // 年齢は数字だが年収が数字でない形＝年齢の妥当性検査だけでは NaN が残る
    expect(decodeFamily('20-x')).toEqual([]);
    for (const f of decodeFamily('20-x_30-1e3')) {
      expect(Number.isInteger(f.annualIncome)).toBe(true);
    }
  });
});

/**
 * 純関数が正しくても、画面がそれを呼んでいなければユーザーには届かない
 * （#149 の未接続監査で見つけた defect と同じ構造）。到達＝import があることまでは
 * reachability.test.ts が見るので、ここでは「入力が実際に渡っているか」を見る。
 */
describe('Calculator への配線', () => {
  const src = readFileSync(new URL('../../components/tedori/Calculator.tsx', import.meta.url), 'utf8');

  it('familyImpact に扶養家族の state を渡している（空配列で呼んでいない）', () => {
    expect(src).toMatch(/familyImpact\(\s*\{[^}]*\},\s*family,\s*\)/);
  });

  it('扶養家族の入力欄を描画している', () => {
    expect(src).toMatch(/<FamilyFields\s+family=\{family\}\s+onChange=\{setFamily\}/);
  });

  it('表示する結果は扶養を反映したほう（withFamily）である', () => {
    expect(src).toContain('const result = impact.withFamily');
    expect(src).not.toContain('impact.withoutFamily');
  });

  it('共有 URL に扶養家族を載せて復元している', () => {
    expect(src).toMatch(/fam:\s*encodeFamily\(family\)/);
    expect(src).toMatch(/setFamily\(decodeFamily\(p\.fam\)\)/);
  });

  it('「扶養なしの場合の概算」という古い断り書きが残っていない', () => {
    expect(src).not.toContain('扶養なしの場合の概算');
  });
});
