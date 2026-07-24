/**
 * 年収の壁 手取り逆転シミュレーターの計算ロジック。
 *
 * パート・アルバイト（配偶者の扶養内で働く人）が年収を上げていくと、
 * 社会保険の加入ライン（106万円 or 130万円）を超えた時点で本人の社会保険料が
 * 発生し、手取りが一時的に下がる（=手取りの逆転／働き損）現象を可視化する。
 *
 * 本人の手取りは tedori（年収の手取り計算）と同じ純関数を再利用して算定する
 * （モノレポ集約の利点＝計算の二重管理を避ける）。壁の下では本人の社会保険料は
 * 0（扶養内）、壁以上では tedori と同じ社会保険料が発生する、という違いだけを扱う。
 *
 * 壁の整理（令和6年時点）:
 *   - 103万円: 本人に所得税がかかり始める（給与所得控除＋基礎控除）。
 *   - 106万円: 勤務先が特定適用事業所等の要件を満たすと社会保険に加入。
 *   - 130万円: 上記に当たらない場合でも、扶養から外れ社会保険に加入。
 *   - 150万円: （世帯側）配偶者特別控除が満額から減り始める。本ツールは本人の手取りを扱う。
 *
 * 出典: 国税庁・日本年金機構・厚生労働省「年収の壁」関連資料。社会保険料・税は tedori と同一仕様。
 *       最終確認日: 2026-07-24。本計算は概算・参考値。
 */

import {
  salaryIncomeDeduction,
  basicDeductionIncomeTax,
  incomeTaxByBracket,
  socialInsurance,
} from "../tedori/calculations";

// 住民税の定数（tedori/calculations.ts と同一の統計値をミラー）。
const RESIDENT_BASIC_DEDUCTION = 430_000; // 住民税の基礎控除
const RESIDENT_LEVY_ROUND = 1000; // 課税標準の1,000円未満切り捨て
const JUMINZEI_KINTOWARI = 5_000; // 住民税 均等割（森林環境税含む）
const RECONSTRUCTION_TAX_MULTIPLIER = 1.021;

/** 社会保険の加入ライン（壁）。 */
export const SOCIAL_INSURANCE_WALLS = {
  /** 特定適用事業所等の要件を満たす場合 */
  small: 1_060_000,
  /** それ以外（扶養から外れる） */
  standard: 1_300_000,
} as const;

export type SiWall = 1_060_000 | 1_300_000;

function clampNonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function floorTo1000(n: number): number {
  return Math.floor(n / RESIDENT_LEVY_ROUND) * RESIDENT_LEVY_ROUND;
}

export type TakeHomeBreakdown = {
  income: number;
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
  takeHome: number;
  enrolled: boolean;
};

/**
 * 本人の年収における手取りを算定する。
 * enrolled=true のとき tedori の calculateNetSalary と同じ結果になる
 * （社会保険料・所得税・住民税の各純関数を同一仕様で組み立てる）。
 *
 * @param income 本人の年収（円）
 * @param enrolled 本人が自分の社会保険に加入しているか（壁の下なら false）
 * @param isOver40 介護保険（40歳以上）
 */
export function takeHomeAtIncome(
  income: number,
  enrolled: boolean,
  isOver40 = false,
): TakeHomeBreakdown {
  const y = clampNonNeg(income);
  const si = enrolled ? socialInsurance(y, isOver40).total : 0;

  const salaryDeduction = salaryIncomeDeduction(y);
  const employmentIncome = Math.max(0, y - salaryDeduction);

  const basicIt = basicDeductionIncomeTax(employmentIncome);
  const taxableIt = floorTo1000(Math.max(0, employmentIncome - si - basicIt));
  const incomeTaxBase = Math.floor(incomeTaxByBracket(taxableIt));
  const incomeTax = Math.floor((incomeTaxBase * 1021) / 1000); // 復興特別所得税込み

  const taxableRt = floorTo1000(Math.max(0, employmentIncome - si - RESIDENT_BASIC_DEDUCTION));
  const residentLevy = Math.floor(taxableRt / 1000) * 100; // 所得割10%を100円未満切り捨て
  const residentTax = taxableRt > 0 ? residentLevy + JUMINZEI_KINTOWARI : 0;

  const takeHome = y - si - incomeTax - residentTax;
  return { income: y, socialInsurance: si, incomeTax, residentTax, takeHome, enrolled };
}

/**
 * 壁を考慮した手取り（壁未満なら未加入・壁以上なら加入）。
 */
export function takeHomeWithWall(
  income: number,
  siWall: SiWall,
  isOver40 = false,
): TakeHomeBreakdown {
  return takeHomeAtIncome(income, income >= siWall, isOver40);
}

export type WallReversal = {
  /** 壁の直前（壁 − 1万円）の手取り */
  takeHomeJustBelow: number;
  /** 壁ちょうどの手取り（加入直後） */
  takeHomeAtWall: number;
  /** 壁を超えて手取りが下がる額（働き損の谷の深さ・円） */
  dropAtWall: number;
  /**
   * 手取りが壁直前の水準まで回復する年収（円）。
   * 「壁を超えるなら、最低これだけ稼がないと手取りが元に戻らない」ライン。
   */
  recoveryIncome: number;
  /** 回復に必要な、壁からの追加年収（円） */
  extraIncomeToRecover: number;
};

/**
 * 壁による手取り逆転（谷）と、その回復に必要な年収を求める。
 * @param siWall 適用する社会保険の壁（106万 or 130万）
 * @param isOver40 介護保険
 */
export function analyzeWallReversal(siWall: SiWall, isOver40 = false): WallReversal {
  const takeHomeJustBelow = takeHomeWithWall(siWall - 10_000, siWall, isOver40).takeHome;
  const takeHomeAtWall = takeHomeWithWall(siWall, siWall, isOver40).takeHome;
  const dropAtWall = Math.max(0, takeHomeJustBelow - takeHomeAtWall);

  // 壁以上で手取りが壁直前の水準まで戻る最小年収を1万円刻みで探索（決定的）。
  let recoveryIncome = siWall;
  const cap = siWall + 1_000_000;
  for (let inc = siWall; inc <= cap; inc += 10_000) {
    if (takeHomeWithWall(inc, siWall, isOver40).takeHome >= takeHomeJustBelow) {
      recoveryIncome = inc;
      break;
    }
    recoveryIncome = inc;
  }
  return {
    takeHomeJustBelow,
    takeHomeAtWall,
    dropAtWall,
    recoveryIncome,
    extraIncomeToRecover: recoveryIncome - siWall,
  };
}
