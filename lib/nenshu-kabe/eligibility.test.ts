/**
 * 壁の判定（D4）のテスト。
 *
 * 制度変更が2段階（2026-10 賃金要件撤廃 / 2027-10 企業規模 51→36）で確定しているため、
 * 施行日の前後を境界値として固定する。日付をまたいだときに黙って挙動が変わるのが
 * いちばん危ないので、施行日ちょうど・前日・翌日を明示的に置く。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  ELIGIBILITY_CHECKED_AT,
  WALL_SCHEDULE,
  firmSizeThreshold,
  judgeWall,
  wageRequirementApplies,
  type WallConditions,
} from './eligibility';
import { getArticle } from './articles';

/** 5条件をすべて満たす基準ケース */
const MEETS_ALL: WallConditions = {
  employeeCount: 51,
  weeklyHours: 20,
  monthlyWage: 88_000,
  employmentOverTwoMonths: true,
  isStudent: false,
};

const TODAY = '2026-08-16';

describe('企業規模しきい値の施行日', () => {
  it('令和9年10月の前日までは51人、当日から36人', () => {
    expect(firmSizeThreshold('2027-09-30')).toBe(51);
    expect(firmSizeThreshold(WALL_SCHEDULE.firmSizeLoweredOn)).toBe(36);
    expect(firmSizeThreshold('2027-10-02')).toBe(36);
  });

  it('現時点（2026-08）は51人', () => {
    expect(firmSizeThreshold(TODAY)).toBe(51);
  });
});

describe('賃金要件（月額8.8万円）の撤廃日', () => {
  it('令和8年10月の前日までは有効、当日から無効', () => {
    expect(wageRequirementApplies('2026-09-30')).toBe(true);
    expect(wageRequirementApplies(WALL_SCHEDULE.wageRequirementRemovedOn)).toBe(false);
    expect(wageRequirementApplies('2026-10-02')).toBe(false);
  });

  it('撤廃後は月額8.8万円未満でも他の条件を満たせば106万の壁が適用される', () => {
    const lowWage = { ...MEETS_ALL, monthlyWage: 80_000 };
    expect(judgeWall(lowWage, '2026-09-30').coveredBy106).toBe(false);
    expect(judgeWall(lowWage, '2026-10-01').coveredBy106).toBe(true);
  });
});

describe('5条件のいずれかを欠くと130万の壁になる', () => {
  it('すべて満たせば106万の壁', () => {
    const r = judgeWall(MEETS_ALL, TODAY);
    expect(r.wall).toBe(1_060_000);
    expect(r.coveredBy106).toBe(true);
    expect(r.unmetConditions).toEqual([]);
  });

  it('従業員数50人以下なら130万の壁（106万を超えても加入しない）', () => {
    const r = judgeWall({ ...MEETS_ALL, employeeCount: 50 }, TODAY);
    expect(r.wall).toBe(1_300_000);
    expect(r.unmetConditions).toContain('勤務先の厚生年金被保険者数が51人未満');
  });

  it('週20時間未満なら130万の壁', () => {
    expect(judgeWall({ ...MEETS_ALL, weeklyHours: 19.5 }, TODAY).wall).toBe(1_300_000);
  });

  it('2か月超の雇用見込みが無ければ130万の壁', () => {
    expect(judgeWall({ ...MEETS_ALL, employmentOverTwoMonths: false }, TODAY).wall).toBe(
      1_300_000,
    );
  });

  it('学生なら130万の壁', () => {
    expect(judgeWall({ ...MEETS_ALL, isStudent: true }, TODAY).wall).toBe(1_300_000);
  });

  it('複数欠けたらすべて列挙する（1つ目で打ち切らない）', () => {
    const r = judgeWall(
      { employeeCount: 10, weeklyHours: 10, monthlyWage: 50_000, employmentOverTwoMonths: false, isStudent: true },
      TODAY,
    );
    expect(r.unmetConditions).toHaveLength(5);
  });
});

describe('境界値（以上／未満を取り違えない）', () => {
  it('従業員数はしきい値ちょうどで満たす', () => {
    expect(judgeWall({ ...MEETS_ALL, employeeCount: 51 }, TODAY).coveredBy106).toBe(true);
    expect(judgeWall({ ...MEETS_ALL, employeeCount: 50 }, TODAY).coveredBy106).toBe(false);
  });

  it('週の所定労働時間は20時間ちょうどで満たす', () => {
    expect(judgeWall({ ...MEETS_ALL, weeklyHours: 20 }, TODAY).coveredBy106).toBe(true);
    expect(judgeWall({ ...MEETS_ALL, weeklyHours: 19.99 }, TODAY).coveredBy106).toBe(false);
  });

  it('月額賃金は88,000円ちょうどで満たす', () => {
    expect(judgeWall({ ...MEETS_ALL, monthlyWage: 88_000 }, TODAY).coveredBy106).toBe(true);
    expect(judgeWall({ ...MEETS_ALL, monthlyWage: 87_999 }, TODAY).coveredBy106).toBe(false);
  });

  it('2027-10 以降は36人ちょうどで満たす', () => {
    const after = '2027-10-01';
    expect(judgeWall({ ...MEETS_ALL, employeeCount: 36 }, after).coveredBy106).toBe(true);
    expect(judgeWall({ ...MEETS_ALL, employeeCount: 35 }, after).coveredBy106).toBe(false);
    // 同じ36人でも現時点では対象外
    expect(judgeWall({ ...MEETS_ALL, employeeCount: 36 }, TODAY).coveredBy106).toBe(false);
  });
});

describe('記事 nenshu-kabe-106-joken の日程が実装と一致している', () => {
  // 記事は「2026年10月に賃金要件撤廃」「2027年10月に36人以上へ」と読者に約束する。
  // その日付が WALL_SCHEDULE とずれたら、施行日をまたいだ瞬間に記事と計算が食い違う。
  const body = (() => {
    const a = getArticle('nenshu-kabe-106-joken');
    if (!a) throw new Error('article not found');
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
      ...a.faqs.flatMap((f) => [f.question, f.answer]),
    ].join('\n');
  })();

  /** '2027-10-01' -> '令和9年（2027年）10月'。和暦と西暦の食い違いもここで捕まえる。 */
  const wareki = (iso: string): string => {
    const yr = Number(iso.slice(0, 4));
    const mo = Number(iso.slice(5, 7));
    return `令和${yr - 2018}年（${yr}年）${mo}月`;
  };

  it('企業規模の拡大時期と新しいしきい値を対で載せている', () => {
    expect(body).toContain(
      `${wareki(WALL_SCHEDULE.firmSizeLoweredOn)}からは${WALL_SCHEDULE.firmSizeThresholdAfter}人以上へ`,
    );
  });

  it('賃金要件の撤廃時期と金額を対で載せている', () => {
    const man = WALL_SCHEDULE.monthlyWageThreshold / 10_000;
    expect(body).toContain(
      `所定内賃金が月額${man}万円以上という要件は${wareki(WALL_SCHEDULE.wageRequirementRemovedOn)}に撤廃される予定`,
    );
  });

  it('現行のしきい値を本文が取り違えていない', () => {
    expect(body).toContain(`${WALL_SCHEDULE.firmSizeThresholdNow}人以上`);
    expect(body).toContain(`週${WALL_SCHEDULE.weeklyHoursThreshold}時間`);
  });

  it('本文にレンダラが解釈しない markdown 記法が残っていない', () => {
    // paragraphs は plain text として描画されるため ** はそのまま表示されてしまう
    expect(body).not.toContain('**');
  });
});

// ============================================================
// H3: 画面への接続（どちらの壁が効くかを利用者に選ばせない）
// ============================================================
describe('H3: 判定を画面につないだ部分', () => {
  const src = readFileSync(
    new URL('../../components/nenshu-kabe/WallJudge.tsx', import.meta.url),
    'utf8',
  );
  const calcSrc = readFileSync(
    new URL('../../components/nenshu-kabe/Calculator.tsx', import.meta.url),
    'utf8',
  );

  it('既定の判定日は現行制度の側にある（51人・賃金要件あり）', () => {
    expect(ELIGIBILITY_CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ELIGIBILITY_CHECKED_AT < WALL_SCHEDULE.wageRequirementRemovedOn).toBe(true);
    expect(firmSizeThreshold(ELIGIBILITY_CHECKED_AT)).toBe(WALL_SCHEDULE.firmSizeThresholdNow);
    expect(wageRequirementApplies(ELIGIBILITY_CHECKED_AT)).toBe(true);
  });

  it('判定結果を計算側の壁に反映している（表示だけで終わっていない）', () => {
    expect(calcSrc).toMatch(/<WallJudge\s+asOf=\{asOf\}\s+onJudge=\{setWall\}/);
    expect(src).toMatch(/onJudge\(result\.wall\)/);
  });

  it('しきい値・施行日を直書きせず WALL_SCHEDULE から描画している', () => {
    for (const literal of ['51人', '36人', '2026-10-01', '2027-10-01', '88,000']) {
      expect(src).not.toContain(literal);
    }
    expect(src).toContain('WALL_SCHEDULE.firmSizeThresholdNow');
    expect(src).toContain('WALL_SCHEDULE.firmSizeThresholdAfter');
    expect(src).toContain('WALL_SCHEDULE.wageRequirementRemovedOn');
  });

  it('賃金要件の入力は、要件が生きている間だけ出す', () => {
    expect(src).toMatch(/result\.wageRequirementApplies\s*&&/);
  });

  it('満たしていない条件をそのまま列挙している（判定の理由を隠さない）', () => {
    // 表示の有無を決める条件式と、実際に並べる map は別の事実なので別々に見る
    // （同じ識別子が2つの役割で出るときは役割ごとに照合する＝#147/#145 の教訓）
    expect(src).toMatch(/result\.unmetConditions\.length > 0\s*&&/);
    expect(src).toMatch(/result\.unmetConditions\.map\(/);
  });

  it('判定日は定数で描画してからマウント後に今日へ差し替える（ハイドレーション不一致を作らない）', () => {
    expect(calcSrc).toContain('useState(ELIGIBILITY_CHECKED_AT)');
    expect(calcSrc).toMatch(/setAsOf\(new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\)/);
  });
});
