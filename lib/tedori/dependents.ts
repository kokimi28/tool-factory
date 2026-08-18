/**
 * 扶養控除・特定親族特別控除（auto-backlog G1）。
 *
 * 本ツールの `calculateNetSalary` は基礎控除しか持っておらず、**扶養親族がいる人の
 * 手取りを計算できなかった**。ふるさと納税ツールだけが概算用に一律38万円の
 * `DEPENDENT_DEDUCTION` を持っていたが、年齢区分（特定扶養親族63万円・老人扶養親族
 * 48万円）も、令和7年度改正で新設された**特定親族特別控除**も反映していなかった。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠（最終確認日: 2026-08-18・e-Gov 法令 API の条文を実測）
 * ─────────────────────────────────────────────────────────────
 *  ■ 所得税法 第2条第1項第34号 … 扶養親族 ＝ 生計を一にする親族で
 *     **合計所得金額58万円以下**（改正前48万円）。給与収入に直すと1,230,000円まで。
 *  ■ 同第34号の2 … 控除対象扶養親族 ＝ 扶養親族のうち**16歳以上**
 *     （16歳未満は児童手当があるため控除の対象外）
 *  ■ 同第34号の3・34号の4 … 特定扶養親族 ＝ 19歳以上23歳未満／老人扶養親族 ＝ 70歳以上
 *  ■ 所得税法 第84条 … 扶養控除 一般 **38万円**／特定 **63万円**／老人 **48万円**
 *  ■ 所得税法 第84条の2（令和7年度改正で新設）… 特定親族特別控除
 *     19歳以上23歳未満で**合計所得金額123万円以下**、かつ控除対象扶養親族に
 *     該当しない（＝合計所得58万円超）親族が対象。
 *       一 85万円以下 → 63万円
 *       二 85万円超115万円以下 → 63万円から「84万1円を超える部分 × 2」を
 *          10万円の整数倍から8万円を引いた額（2万・12万・22万…）に切り下げて控除
 *       三 115万円超120万円以下 → 6万円
 *       四 120万円超 → 3万円
 *  ■ 地方税法 第314条の2第1項第11号 … 住民税の扶養控除 一般 **33万円**／特定 **45万円**／老人 **38万円**
 *  ■ 同第12号 … 住民税の特定親族特別控除。**95万円以下で45万円**（所得税は85万円以下で63万円）、
 *     95万円超115万円以下は所得税と同じ逓減式、115万円超120万円以下6万円、120万円超3万円
 *
 *  ※ 所得税と住民税で「満額の範囲」も「額」も違う（85万/95万・63万/45万）。
 *    配偶者特別控除と同じ構造で、片方だけ見ると世帯の負担を取り違える。
 *
 *  ※ 同居老親等の加算（所得税58万円・住民税45万円）は租税特別措置法側の規定で、
 *    本ファイルでは扱っていない。老人扶養親族は同居でない場合の額（48万/38万）を返す。
 *    加算を入れるときは条文を確認してから追加すること。
 */

import { salaryForTotalIncome } from './calculations';

/** 最終的に条文を確認した日。 */
export const DEPENDENT_LAW_CHECKED_AT = '2026-08-18';

/** 扶養親族になれる合計所得金額の上限（所得税法2条1項34号）。 */
export const DEPENDENT_INCOME_LIMIT = 580_000;

/** 扶養控除の額（円）。所得税法84条・地方税法314条の2第1項11号。 */
export const DEPENDENT_DEDUCTION = {
  incomeTax: { general: 380_000, specific: 630_000, elderly: 480_000 },
  residentTax: { general: 330_000, specific: 450_000, elderly: 380_000 },
} as const;

/** 特定親族特別控除の境目（合計所得金額・円）。所得税法84条の2／地方税法314条の2第1項12号。 */
export const SPECIFIC_RELATIVE_THRESHOLDS = {
  /** 満額の上限・所得税 */
  fullIncomeTax: 850_000,
  /** 満額の上限・住民税 */
  fullResidentTax: 950_000,
  /** 逓減の起点（84万1円） */
  taperFrom: 840_001,
  /** ここを超えると6万円 */
  sixManFrom: 1_150_000,
  /** ここを超えると3万円 */
  threeManFrom: 1_200_000,
  /** 適用上限 */
  max: 1_230_000,
} as const;

/** 扶養親族の年齢区分。 */
export type DependentKind =
  /** 16歳未満（控除なし・児童手当の対象） */
  | 'underSixteen'
  /** 一般（16〜18歳・23〜69歳） */
  | 'general'
  /** 特定扶養親族（19〜22歳） */
  | 'specific'
  /** 老人扶養親族（70歳以上） */
  | 'elderly';

/** 年齢から扶養控除の区分を求める（所得税法2条1項34号の2〜34号の4）。 */
export function dependentKindByAge(age: number): DependentKind {
  const a = Number.isFinite(age) && age > 0 ? Math.floor(age) : 0;
  if (a < 16) return 'underSixteen';
  if (a >= 19 && a < 23) return 'specific';
  if (a >= 70) return 'elderly';
  return 'general';
}

const nonNeg = (n: number | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

/**
 * 特定親族特別控除の逓減部分（所得税法84条の2第1項2号）。
 *
 * 「84万1円を超える部分の金額に**2を乗じた**金額」を、10万円の整数倍から8万円を
 * 引いた額（2万・12万・22万…）に切り下げてから63万円より控除する。
 * 配偶者特別控除（5万円刻み）と刻み幅も乗数も違うので、使い回してはいけない。
 */
function taperedSpecificRelative(totalIncome: number): number {
  const doubled = (totalIncome - SPECIFIC_RELATIVE_THRESHOLDS.taperFrom) * 2;
  if (doubled < 20_000) return 630_000; // 切り下げ先が存在しない＝満額
  const step = Math.floor((doubled - 20_000) / 100_000) * 100_000 + 20_000;
  return Math.max(0, 630_000 - step);
}

export interface DependentDeductionResult {
  /** 所得税の控除額（円） */
  incomeTax: number;
  /** 住民税の控除額（円） */
  residentTax: number;
  /** どの制度で出た額か */
  kind: 'dependentDeduction' | 'specificRelative' | 'none';
}

/**
 * 扶養親族1人ぶんの控除額を求める。
 *
 * @param age         その親族の年齢
 * @param totalIncome その親族の合計所得金額（円）
 */
export function dependentDeduction(age: number, totalIncome = 0): DependentDeductionResult {
  const income = nonNeg(totalIncome);
  const kind = dependentKindByAge(age);
  const none: DependentDeductionResult = { incomeTax: 0, residentTax: 0, kind: 'none' };

  // 合計所得58万円以下なら扶養控除。16歳未満は控除の対象外。
  if (income <= DEPENDENT_INCOME_LIMIT) {
    if (kind === 'underSixteen') return none;
    return {
      incomeTax: DEPENDENT_DEDUCTION.incomeTax[kind],
      residentTax: DEPENDENT_DEDUCTION.residentTax[kind],
      kind: 'dependentDeduction',
    };
  }

  // 58万円を超えたら、19〜22歳だけ特定親族特別控除に引き継がれる
  if (kind !== 'specific') return none;
  if (income > SPECIFIC_RELATIVE_THRESHOLDS.max) return none;

  const t = SPECIFIC_RELATIVE_THRESHOLDS;
  const incomeTax =
    income <= t.fullIncomeTax
      ? 630_000
      : income > t.threeManFrom
        ? 30_000
        : income > t.sixManFrom
          ? 60_000
          : taperedSpecificRelative(income);
  const residentTax =
    income <= t.fullResidentTax
      ? 450_000
      : income > t.threeManFrom
        ? 30_000
        : income > t.sixManFrom
          ? 60_000
          : taperedSpecificRelative(income);

  return { incomeTax, residentTax, kind: 'specificRelative' };
}

/** 世帯の扶養親族1人の指定。 */
export interface FamilyMember {
  /** 年齢 */
  age: number;
  /** その人の合計所得金額（円・既定0） */
  totalIncome?: number;
}

/** 扶養親族をまとめた控除額（円）。 */
export function familyDeduction(members: readonly FamilyMember[] = []): {
  incomeTax: number;
  residentTax: number;
} {
  return members.reduce(
    (acc, m) => {
      const d = dependentDeduction(m.age, m.totalIncome);
      return { incomeTax: acc.incomeTax + d.incomeTax, residentTax: acc.residentTax + d.residentTax };
    },
    { incomeTax: 0, residentTax: 0 },
  );
}

/** 給与収入で言った「扶養の壁」（円）。合計所得の条文値から給与所得控除で逆算する。 */
export function dependentWallsBySalary(): {
  /** 扶養控除が使える上限（合計所得58万円） */
  dependentLimit: number;
  /** 特定親族特別控除が満額63万円で使える上限（合計所得85万円） */
  specificFullLimit: number;
  /** 特定親族特別控除が使える上限（合計所得123万円） */
  specificMaxLimit: number;
} {
  return {
    dependentLimit: salaryForTotalIncome(DEPENDENT_INCOME_LIMIT),
    specificFullLimit: salaryForTotalIncome(SPECIFIC_RELATIVE_THRESHOLDS.fullIncomeTax),
    specificMaxLimit: salaryForTotalIncome(SPECIFIC_RELATIVE_THRESHOLDS.max),
  };
}
