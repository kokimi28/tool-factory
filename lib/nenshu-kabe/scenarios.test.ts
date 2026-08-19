import { describe, expect, it } from 'vitest';
import {
  wallScenarios,
  householdBurdenStartsAt,
  REFERENCE_FILER_SALARY,
  type WallScenarioKind,
} from './scenarios';
import { analyzeWallReversal, takeHomeWithWall, type SiWall } from './calculations';
import { householdImpact, spouseWallsBySalary } from './spouse-deduction';
import { ARTICLES, getArticle } from './articles';
import { readFileSync } from 'node:fs';

const WALLS: SiWall[] = [1_060_000, 1_300_000];
const ORDER: WallScenarioKind[] = ['stayBelow', 'justOver', 'recovered'];

describe('wallScenarios（E5・3シナリオ横並び）', () => {
  it.each(WALLS)('壁 %i で3案を決まった順に返す', (wall) => {
    const rows = wallScenarios(wall);
    expect(rows.map((r) => r.kind)).toEqual(ORDER);
    expect(rows.map((r) => r.income)).toEqual([
      wall - 10_000,
      wall,
      analyzeWallReversal(wall).recoveryIncome,
    ]);
  });

  it.each(WALLS)('壁 %i の年収は昇順で、壁の下だけ未加入', (wall) => {
    const rows = wallScenarios(wall);
    expect(rows[0].income).toBeLessThan(rows[1].income);
    expect(rows[1].income).toBeLessThan(rows[2].income);
    expect(rows.map((r) => r.enrolled)).toEqual([false, true, true]);
    expect(rows[0].socialInsurance).toBe(0);
    expect(rows[1].socialInsurance).toBeGreaterThan(0);
  });

  it.each(WALLS)('壁 %i の谷＝超えた直後だけ手取りが下がり、回復ラインで戻る', (wall) => {
    const [below, justOver, recovered] = wallScenarios(wall);
    expect(below.takeHomeDiff).toBe(0);
    expect(justOver.takeHomeDiff).toBeLessThan(0);
    expect(recovered.takeHomeDiff).toBeGreaterThanOrEqual(0);
    // 回復ラインの1つ手前（1万円下）ではまだ戻っていない＝最小の回復年収であること
    const oneStepBefore = takeHomeWithWall(recovered.income - 10_000, wall).takeHome;
    expect(oneStepBefore).toBeLessThan(below.takeHome);
  });

  // 本命: 社会保険の壁を超えても、扶養している側の税は増えない。
  it.each(WALLS)('壁 %i の3案とも扶養している側の追加負担は0円', (wall) => {
    for (const row of wallScenarios(wall)) {
      expect(row.filerTaxIncrease).toBe(0);
    }
  });

  it('追加負担0円は扶養している側の年収に依存しない（差を取ると消えるため）', () => {
    for (const wall of WALLS) {
      for (const income of wallScenarios(wall).map((r) => r.income)) {
        for (let filer = 3_000_000; filer <= 10_000_000; filer += 500_000) {
          expect(householdImpact(filer, income).filerTaxIncrease).toBe(0);
        }
      }
    }
  });

  it('3案の年収はすべて配偶者特別控除が満額の範囲に収まる（0円の理由）', () => {
    const fullLimit = spouseWallsBySalary().specialFullLimit;
    for (const wall of WALLS) {
      for (const row of wallScenarios(wall)) {
        expect(row.income).toBeLessThanOrEqual(fullLimit);
      }
    }
  });

  it('介護保険（40歳以上）でも谷は深くなるが3案の構造は変わらない', () => {
    for (const wall of WALLS) {
      const under40 = wallScenarios(wall);
      const over40 = wallScenarios(wall, true);
      expect(over40.map((r) => r.kind)).toEqual(ORDER);
      expect(over40[1].takeHome).toBeLessThan(under40[1].takeHome);
      expect(over40[2].income).toBeGreaterThanOrEqual(under40[2].income);
      for (const row of over40) expect(row.filerTaxIncrease).toBe(0);
    }
  });
});

describe('householdBurdenStartsAt（扶養側の負担が始まる年収）', () => {
  it('配偶者特別控除の満額上限を1円超えた地点', () => {
    expect(householdBurdenStartsAt()).toBe(spouseWallsBySalary().specialFullLimit + 1);
  });

  it('その1円手前までは0円・そこからは正になる（境界の実測）', () => {
    const start = householdBurdenStartsAt();
    expect(householdImpact(REFERENCE_FILER_SALARY, start - 1).filerTaxIncrease).toBe(0);
    let firstPositive = 0;
    for (let income = start - 1; income <= start + 200_000; income += 1_000) {
      if (householdImpact(REFERENCE_FILER_SALARY, income).filerTaxIncrease > 0) {
        firstPositive = income;
        break;
      }
    }
    expect(firstPositive).toBeGreaterThanOrEqual(start);
    expect(firstPositive).toBeLessThan(start + 20_000);
  });

  it('社会保険の壁はどちらもこのラインより手前にある', () => {
    for (const wall of WALLS) {
      expect(wall).toBeLessThan(householdBurdenStartsAt());
    }
  });
});

// ============================================================
// 文面ロック（E5）
// 「扶養を外れると扶養している側の税が増える」という通念は、配偶者については
// 社会保険の壁で成り立たない。記事とコンポーネントの文面が、その結論および
// 導出元のしきい値とずれないように固定する。
// 期待値は spouseWallsBySalary()（条文の合計所得から導出）から取る。
// ============================================================
describe('文面ロック（E5）', () => {
  const walls = spouseWallsBySalary();
  const yenStr = (n: number) => `${n.toLocaleString('en-US')}円`;

  /** 記事を「1つの主張」の単位（段落・箇条書き・FAQ は質問と回答で1つ）に分解する。 */
  const unitsOf = (slug: string): string[] => {
    const a = getArticle(slug);
    if (!a) throw new Error(`article not found: ${slug}`);
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
      ...a.faqs.map((f) => `${f.question}\n${f.answer}`),
    ];
  };

  it('撤回した「扶養している側の税負担が増える」は全記事から消えている', () => {
    for (const a of ARTICLES) {
      for (const unit of unitsOf(a.slug)) {
        expect(unit).not.toContain('扶養している側の税負担が増える');
      }
    }
  });

  it('103万円の記事が、増えない理由を導出値付きで1つの段落に書いている', () => {
    const unit = unitsOf('nenshu-kabe-103').find((u) => u.includes('増えません'));
    expect(unit).toBeDefined();
    expect(unit).toContain(yenStr(walls.spouseDeductionLimit));
    expect(unit).toContain(yenStr(walls.specialFullLimit));
  });

  it('ScenarioCompare の脚注に出る金額はすべて導出値と一致する', () => {
    const src = readFileSync(
      new URL('../../components/nenshu-kabe/ScenarioCompare.tsx', import.meta.url),
      'utf8',
    );
    // 直書きされた「◯,◯◯◯,◯◯◯円」を全部拾い、導出値のいずれかであることを求める
    const literals = [...src.matchAll(/[\d,]{7,}円/g)].map((m) => m[0]);
    expect(literals.length).toBeGreaterThan(0);
    const allowed = new Set([yenStr(walls.spouseDeductionLimit)]);
    for (const literal of literals) expect(allowed).toContain(literal);
    // 減り始めるラインは直書きせず householdBurdenStartsAt() から描画すること
    expect(src).toContain('householdBurdenStartsAt');
    expect(src).not.toContain(yenStr(walls.specialFullLimit));
  });

  it('ScenarioCompare は追加負担が0円でない場合に脚注を出さない', () => {
    const src = readFileSync(
      new URL('../../components/nenshu-kabe/ScenarioCompare.tsx', import.meta.url),
      'utf8',
    );
    // 「3案とも0円」という断定は allZero を条件にしてのみ描画される
    expect(src).toMatch(/allZero\s*&&/);
    expect(src).toMatch(/const allZero\s*=\s*rows\.every\(\(r\)\s*=>\s*r\.filerTaxIncrease === 0\)/);
  });
});
