/**
 * 配偶者控除・配偶者特別控除（auto-backlog G6）。
 *
 * 本ツールは「本人（働く側）の手取り」だけをモデル化しており、**扶養する側＝世帯の税**は
 * 一度も計算していなかった。記事も「扶養している側の税負担が増える点は別途あります」と
 * 書くだけで額を示せておらず、しかも本文が使っていた壁（103万・150万・201.6万）は
 * **令和7年度税制改正より前の値**のまま published されていた。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠（最終確認日: 2026-08-18・e-Gov 法令 API の条文を実測）
 * ─────────────────────────────────────────────────────────────
 *  ■ 所得税法 第2条第1項第33号 … 同一生計配偶者 ＝ 合計所得金額が **58万円以下**
 *     （改正前は48万円。給与所得控除の最低額65万円と合わせると給与収入 **123万円** が境目）
 *  ■ 所得税法 第83条 … 配偶者控除（納税者の合計所得900万円以下で **38万円**、
 *     900万超950万以下26万円、950万超1,000万以下13万円。老人控除対象配偶者は48/32/16万円）
 *  ■ 所得税法 第83条の2 … 配偶者特別控除（納税者の合計所得1,000万円以下・配偶者の合計所得
 *     **133万円以下**が対象）
 *       イ 配偶者の合計所得 **95万円以下** → 38万円（満額）
 *       ロ 95万円超130万円以下 → 38万円から「93万1円を超える部分」を差し引く。
 *          ただし差し引く額は「5万円の整数倍から3万円を控除した額」（2万・7万・12万…）に切り下げる
 *       ハ 130万円超 → 3万円
 *       ※ 納税者の合計所得が900万超950万以下なら2/3、950万超1,000万以下なら1/3（1万円未満切上げ）
 *  ■ 地方税法 第314条の2第1項第10号 … 住民税の配偶者控除（900万円以下で **33万円**、老人38万円）
 *  ■ 地方税法 第314条の2第1項第10号の2 … 住民税の配偶者特別控除
 *       配偶者の合計所得 **100万円以下 → 33万円**（所得税の95万円と範囲が違う）
 *       100万円超130万円以下 → 所得税と同じ逓減式、130万円超 → 3万円
 *
 *  ※ 所得税と住民税で満額の範囲が違う（95万円 / 100万円）。片方だけ見て「同じ」と扱うと
 *    世帯の負担額を取り違える。
 *
 * ─────────────────────────────────────────────────────────────
 *  「壁」を給与収入で言うといくらか
 * ─────────────────────────────────────────────────────────────
 *  壁は法律上すべて**合計所得金額**で定義されている。給与収入の額は給与所得控除を通じて
 *  そこから導かれる従属値なので、本ファイルでは数値をハードコードせず
 *  `salaryForTotalIncome()` で lib/tedori の給与所得控除から逆算する。
 *  給与所得控除が改正されれば壁も自動で動く（103万・150万・201.6万を直書きしていた
 *  従来の記事が改正で古くなったのは、この従属関係を固定値で書いていたため）。
 */

import {
  basicDeductionIncomeTax,
  floorTo1000,
  incomeTaxByBracket,
  salaryForTotalIncome,
  salaryIncomeDeduction,
  socialInsurance,
} from '../tedori/calculations';

import { takeHomeWithWall } from './calculations';

// 給与所得控除の逆算は lib/tedori（給与所得控除の定義がある側）が正。
// ここでは再輸出だけして、既存の import 経路を保つ。
export { salaryForTotalIncome };

/** 住民税の基礎控除（地方税法314条の2第2項）。calculations.ts と同じ値。 */
const RESIDENT_BASIC_DEDUCTION = 430_000;
/** 住民税 均等割（森林環境税含む）。calculations.ts と同じ値。 */
const JUMINZEI_KINTOWARI = 5_000;

/** 最終的に条文を確認した日。 */
export const SPOUSE_LAW_CHECKED_AT = '2026-08-18';

/** 合計所得金額で定義される境目（円）。すべて条文の値。 */
export const SPOUSE_INCOME_THRESHOLDS = {
  /** 同一生計配偶者＝配偶者控除の対象（所得税法2条1項33号） */
  sameHousehold: 580_000,
  /** 配偶者特別控除が満額になる上限・所得税（83条の2第1項1号イ） */
  specialFullIncomeTax: 950_000,
  /** 同・住民税（地方税法314条の2第1項10号の2イ(1)） */
  specialFullResidentTax: 1_000_000,
  /** 逓減の起点（83条の2第1項1号ロ「93万1円を超える部分」） */
  taperFrom: 930_001,
  /** ここを超えると一律3万円（83条の2第1項1号ハ） */
  taperEnd: 1_300_000,
  /** 配偶者特別控除の適用上限（83条の2第1項本文） */
  specialMax: 1_330_000,
} as const;

/** 納税者（扶養する側）の合計所得による按分（83条の2第1項2号・3号）。 */
const FILER_BANDS = [
  { upTo: 9_000_000, share: 1 },
  { upTo: 9_500_000, share: 2 / 3 },
  { upTo: 10_000_000, share: 1 / 3 },
] as const;

/** 配偶者控除の額（所得税・円）。老人控除対象配偶者は 48/32/16 万円。 */
const SPOUSE_DEDUCTION_INCOME_TAX = [
  { upTo: 9_000_000, normal: 380_000, elderly: 480_000 },
  { upTo: 9_500_000, normal: 260_000, elderly: 320_000 },
  { upTo: 10_000_000, normal: 130_000, elderly: 160_000 },
] as const;

/** 配偶者控除の額（住民税・円）。老人控除対象配偶者は 38/26/13 万円。 */
const SPOUSE_DEDUCTION_RESIDENT_TAX = [
  { upTo: 9_000_000, normal: 330_000, elderly: 380_000 },
  { upTo: 9_500_000, normal: 220_000, elderly: 260_000 },
  { upTo: 10_000_000, normal: 110_000, elderly: 130_000 },
] as const;

const nonNeg = (n: number | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

/** 1万円未満切上げ（83条の2第1項2号・3号の按分で使う）。 */
const ceilTo10k = (n: number): number => Math.ceil(n / 10_000) * 10_000;

/**
 * 逓減部分（83条の2第1項1号ロ）。
 *
 * 「93万1円を超える部分の金額」を、5万円の整数倍から3万円を引いた額
 * （2万・7万・12万・17万…）に**切り下げて**から38万円より控除する。
 * この階段のおかげで控除額は5万円刻みで下がる。
 */
function taperedDeduction(spouseTotalIncome: number): number {
  const excess = spouseTotalIncome - SPOUSE_INCOME_THRESHOLDS.taperFrom;
  if (excess < 20_000) return 380_000; // 切り下げ先が存在しない＝満額のまま
  // 20_000, 70_000, 120_000, ... のうち excess を超えない最大値
  const step = Math.floor((excess - 20_000) / 50_000) * 50_000 + 20_000;
  return Math.max(0, 380_000 - step);
}

function filerShare(filerTotalIncome: number): number {
  const band = FILER_BANDS.find((b) => filerTotalIncome <= b.upTo);
  return band ? band.share : 0;
}

export interface SpouseDeductionResult {
  /** 所得税の控除額（円） */
  incomeTax: number;
  /** 住民税の控除額（円） */
  residentTax: number;
  /** どの制度で出た額か */
  kind: 'spouseDeduction' | 'specialDeduction' | 'none';
}

/**
 * 配偶者控除・配偶者特別控除の額を求める。
 *
 * @param spouseTotalIncome 配偶者（働く側）の合計所得金額（円）
 * @param filerTotalIncome  納税者（扶養する側）の合計所得金額（円）
 * @param spouseIsElderly   配偶者が70歳以上か（老人控除対象配偶者）
 */
export function spouseDeduction(
  spouseTotalIncome: number,
  filerTotalIncome: number,
  spouseIsElderly = false,
): SpouseDeductionResult {
  const sp = nonNeg(spouseTotalIncome);
  const filer = nonNeg(filerTotalIncome);
  const none: SpouseDeductionResult = { incomeTax: 0, residentTax: 0, kind: 'none' };

  // 納税者の合計所得が1,000万円を超えるとどちらの控除も使えない
  if (filer > 10_000_000) return none;

  // 配偶者控除（同一生計配偶者＝合計所得58万円以下）
  if (sp <= SPOUSE_INCOME_THRESHOLDS.sameHousehold) {
    const it = SPOUSE_DEDUCTION_INCOME_TAX.find((b) => filer <= b.upTo)!;
    const rt = SPOUSE_DEDUCTION_RESIDENT_TAX.find((b) => filer <= b.upTo)!;
    return {
      incomeTax: spouseIsElderly ? it.elderly : it.normal,
      residentTax: spouseIsElderly ? rt.elderly : rt.normal,
      kind: 'spouseDeduction',
    };
  }

  // 配偶者特別控除（合計所得133万円以下）
  if (sp > SPOUSE_INCOME_THRESHOLDS.specialMax) return none;

  const share = filerShare(filer);
  const baseIncomeTax =
    sp <= SPOUSE_INCOME_THRESHOLDS.specialFullIncomeTax
      ? 380_000
      : sp > SPOUSE_INCOME_THRESHOLDS.taperEnd
        ? 30_000
        : taperedDeduction(sp);
  const baseResidentTax =
    sp <= SPOUSE_INCOME_THRESHOLDS.specialFullResidentTax
      ? 330_000
      : sp > SPOUSE_INCOME_THRESHOLDS.taperEnd
        ? 30_000
        : taperedDeduction(sp);

  const apply = (base: number): number =>
    share === 1 ? base : ceilTo10k(base * share);

  return {
    incomeTax: apply(baseIncomeTax),
    residentTax: apply(baseResidentTax),
    kind: 'specialDeduction',
  };
}

/** 給与収入で言った「税の壁」（円）。すべて条文の合計所得から導出する。 */
export function spouseWallsBySalary(): {
  /** 配偶者控除が満額で使える上限（同一生計配偶者） */
  spouseDeductionLimit: number;
  /** 配偶者特別控除が満額（38万円）で使える上限・所得税 */
  specialFullLimit: number;
  /** 配偶者特別控除がゼロになるライン */
  specialZeroFrom: number;
} {
  return {
    spouseDeductionLimit: salaryForTotalIncome(SPOUSE_INCOME_THRESHOLDS.sameHousehold),
    specialFullLimit: salaryForTotalIncome(SPOUSE_INCOME_THRESHOLDS.specialFullIncomeTax),
    specialZeroFrom: salaryForTotalIncome(SPOUSE_INCOME_THRESHOLDS.specialMax),
  };
}

// ============================================================
// 世帯側（扶養する人）の負担
// ============================================================

/**
 * 扶養する側の所得税・住民税を、配偶者（特別）控除を反映して求める。
 *
 * 税額の組み立ては本ツールの `takeHomeAtIncome` と同じ純関数を同じ順序で使う
 * （給与所得控除 → 社会保険料控除 → 基礎控除 → 配偶者（特別）控除 → 速算表）。
 * 端数処理は lib/rounding.test.ts の単位表どおり（課税標準1,000円・年税額100円）。
 */
export function filerTaxWithSpouse(
  filerSalary: number,
  spouseSalary: number,
  options: { isOver40?: boolean; spouseIsElderly?: boolean } = {},
): { incomeTax: number; residentTax: number; total: number; deduction: SpouseDeductionResult } {
  const salary = nonNeg(filerSalary);
  const si = socialInsurance(salary, options.isOver40 ?? false).total;
  const employmentIncome = Math.max(0, salary - salaryIncomeDeduction(salary));
  const spouseTotalIncome = Math.max(0, nonNeg(spouseSalary) - salaryIncomeDeduction(nonNeg(spouseSalary)));
  const ded = spouseDeduction(spouseTotalIncome, employmentIncome, options.spouseIsElderly);

  const taxableIt = floorTo1000(
    Math.max(0, employmentIncome - si - basicDeductionIncomeTax(employmentIncome) - ded.incomeTax),
  );
  const incomeTax = Math.floor((Math.floor(incomeTaxByBracket(taxableIt)) * 1021) / 1000 / 100) * 100;

  const taxableRt = floorTo1000(
    Math.max(0, employmentIncome - si - RESIDENT_BASIC_DEDUCTION - ded.residentTax),
  );
  const residentLevy = Math.floor(taxableRt / 1000) * 100;
  const residentTax = taxableRt > 0 ? residentLevy + JUMINZEI_KINTOWARI : 0;

  return { incomeTax, residentTax, total: incomeTax + residentTax, deduction: ded };
}

export interface HouseholdImpact {
  /** 配偶者（働く側）の年収（円） */
  spouseSalary: number;
  /** 働く側本人の手取り（円） */
  spouseNet: number;
  /** 扶養する側の税（円） */
  filerTax: number;
  /** 控除が満額だったときと比べた、扶養する側の税の増加（円） */
  filerTaxIncrease: number;
  /** 世帯の手取り合計（働く側の手取り ＋ 扶養する側の手取り・円） */
  householdNet: number;
}

/**
 * 配偶者の年収を動かしたときの、世帯全体の手取りを求める。
 *
 * 記事が「扶養している側の税負担が増える点は別途あります」と書くだけで
 * 示せていなかった額そのもの。控除が満額のとき（配偶者の年収が壁の下）を基準に、
 * そこからいくら増えるかを返す。
 */
export function householdImpact(
  filerSalary: number,
  spouseSalary: number,
  options: { isOver40?: boolean; spouseIsElderly?: boolean } = {},
): HouseholdImpact {
  const spouse = nonNeg(spouseSalary);
  const withSpouse = filerTaxWithSpouse(filerSalary, spouse, options);
  // 基準＝配偶者控除が満額で使える状態（配偶者の年収が同一生計配偶者の範囲内）
  const baseline = filerTaxWithSpouse(filerSalary, 0, options);
  const spouseSelf = takeHomeWithWall(spouse, 1_300_000, options.isOver40 ?? false);
  const filerNet = nonNeg(filerSalary) - socialInsurance(nonNeg(filerSalary), options.isOver40 ?? false).total - withSpouse.total;
  return {
    spouseSalary: spouse,
    spouseNet: spouseSelf.takeHome,
    filerTax: withSpouse.total,
    filerTaxIncrease: withSpouse.total - baseline.total,
    householdNet: spouseSelf.takeHome + filerNet,
  };
}
