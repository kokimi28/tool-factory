/**
 * 年収の壁における3シナリオ横並び比較（auto-backlog E5）。
 *
 * 壁をまたぐときに実際に選べる働き方は3つしかない。
 *   1. 壁の下に抑える（壁 − 1万円）
 *   2. 壁を超えた直後（壁ちょうど）＝働き損の谷の底
 *   3. 手取りが戻るライン（谷を抜けて壁の直前と同じ手取りに戻る年収）
 *
 * 本ツールはこれまで「本人の手取り」だけを出しており、世帯側（扶養している人）の
 * 税がどうなるかは「含めていません」と断っていた。lib/nenshu-kabe/spouse-deduction.ts
 * （配偶者控除・配偶者特別控除のモデル）で答えが出せるので、各シナリオに
 * 「扶養している側の追加負担」を付ける。
 *
 * 結論として3案とも追加負担は0円になる。令和7年度改正後、配偶者控除（合計所得58万
 * ＝給与1,230,000円）を超えても配偶者特別控除が満額38万円で引き継ぎ、それが維持
 * されるのは給与1,600,000円まで。106万・130万の壁はどちらもその内側にあるため、
 * 壁を超えても扶養している側の控除は1円も減らない。「扶養を外れる＝世帯の税が増える」
 * という通念が、社会保険の壁については成り立たないことを数字で示す。
 */

import { analyzeWallReversal, takeHomeWithWall, type SiWall } from './calculations';
import { householdImpact, spouseWallsBySalary } from './spouse-deduction';

/**
 * 「扶養している側の追加負担」を出すときの基準年収（円）。
 *
 * 追加負担は「配偶者（特別）控除が満額のときとの差」なので、控除額が同じで
 * ある限り扶養している側の年収に関係なく0円になる（差を取ると消える）。
 * 表示のために1つ選ぶだけの値で、結果は基準年収に依存しない
 * ＝ scenarios.test.ts が年収300万〜1,000万で不変であることを固定する。
 */
export const REFERENCE_FILER_SALARY = 5_000_000;

export type WallScenarioKind = 'stayBelow' | 'justOver' | 'recovered';

export interface WallScenario {
  kind: WallScenarioKind;
  /** 画面に出す短いラベル */
  label: string;
  /** 本人の年収（円） */
  income: number;
  /** 本人の手取り（円） */
  takeHome: number;
  /** 本人の社会保険料（円） */
  socialInsurance: number;
  /** 本人が社会保険に加入するか */
  enrolled: boolean;
  /** 「壁の下に抑える」案と比べた本人の手取りの差（円・マイナスなら働き損） */
  takeHomeDiff: number;
  /** 扶養している側の税の増加（円）＝配偶者（特別）控除が満額のときとの差 */
  filerTaxIncrease: number;
}

/** シナリオの並び順と表示名。 */
const SCENARIO_LABELS: Record<WallScenarioKind, string> = {
  stayBelow: '壁の下に抑える',
  justOver: '壁を超えた直後',
  recovered: '手取りが戻るライン',
};

/**
 * 3シナリオを横並びで返す。
 *
 * @param wall 適用される社会保険の壁（106万 or 130万）
 * @param isOver40 介護保険（40歳以上）
 */
export function wallScenarios(wall: SiWall, isOver40 = false): WallScenario[] {
  const reversal = analyzeWallReversal(wall, isOver40);
  const points: { kind: WallScenarioKind; income: number }[] = [
    { kind: 'stayBelow', income: wall - 10_000 },
    { kind: 'justOver', income: wall },
    { kind: 'recovered', income: reversal.recoveryIncome },
  ];

  return points.map(({ kind, income }) => {
    const self = takeHomeWithWall(income, wall, isOver40);
    const household = householdImpact(REFERENCE_FILER_SALARY, income, { isOver40 });
    return {
      kind,
      label: SCENARIO_LABELS[kind],
      income,
      takeHome: self.takeHome,
      socialInsurance: self.socialInsurance,
      enrolled: self.enrolled,
      takeHomeDiff: self.takeHome - reversal.takeHomeJustBelow,
      filerTaxIncrease: household.filerTaxIncrease,
    };
  });
}

/**
 * 扶養している側の控除が減り始める本人の年収（円）。
 *
 * 配偶者特別控除が満額でいられる上限（給与1,600,000円＝合計所得95万円）を
 * 1円でも超えた時点。値は条文のしきい値から導出し、ここでは書かない。
 */
export function householdBurdenStartsAt(): number {
  return spouseWallsBySalary().specialFullLimit + 1;
}
