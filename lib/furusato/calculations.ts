/**
 * ふるさと納税 控除上限額（自己負担2,000円で済む寄付額の目安）の計算ロジック。
 *
 * 総務省が公表している「全額控除されるふるさと納税額（年間上限）の目安」の式に基づく:
 *
 *   控除上限額 = 個人住民税所得割額 × 20% ÷ (90% − 所得税率 × 1.021) + 2,000円
 *
 *   - 個人住民税所得割額 = 課税総所得金額 × 10%（都道府県民税4% + 市区町村民税6%）
 *   - 90% = 100% − 住民税からの控除（基本分）10%
 *   - 所得税率 = 課税総所得金額に対する限界税率（5〜45%の累進）
 *   - × 1.021 = 復興特別所得税（2.1%）込み
 *
 * 出典: 総務省「ふるさと納税ポータルサイト（控除額の計算）」／地方税法第37条の2・第314条の7、
 *       租税特別措置法・所得税法第78条。最終確認日: 2026-07-24。
 *
 * ⚠ 本計算は概算・目安です。医療費控除・住宅ローン控除・iDeCo 等の他の控除、
 *    ふるさと納税以外の寄付金控除がある場合は上限が変わります。正確な額は
 *    お住まいの自治体・税理士にご確認ください。
 */

const RECONSTRUCTION_TAX_MULTIPLIER = 1.021; // 復興特別所得税込み
const RESIDENT_TAX_LEVY_RATE = 0.1; // 住民税所得割 10%
const RESIDENT_BASIC_CREDIT_RATE = 0.9; // 90% = 100% − 基本分10%
const SELF_PAYMENT = 2000; // 自己負担2,000円

/** 課税総所得金額に対する所得税の限界税率（速算表の税率区分）。 */
const MARGINAL_BRACKETS: ReadonlyArray<{ upTo: number; rate: number }> = [
  { upTo: 1_950_000, rate: 0.05 },
  { upTo: 3_300_000, rate: 0.1 },
  { upTo: 6_950_000, rate: 0.2 },
  { upTo: 9_000_000, rate: 0.23 },
  { upTo: 18_000_000, rate: 0.33 },
  { upTo: 40_000_000, rate: 0.4 },
  { upTo: Infinity, rate: 0.45 },
];

function clampNonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 課税総所得金額に対する所得税の限界税率を返す。
 * @param taxableTotalIncome 課税総所得金額（円）
 */
export function marginalIncomeTaxRate(taxableTotalIncome: number): number {
  const t = clampNonNeg(taxableTotalIncome);
  const bracket = MARGINAL_BRACKETS.find((b) => t <= b.upTo);
  return bracket ? bracket.rate : 0;
}

/**
 * 個人住民税所得割額（課税総所得金額 × 10%、1円未満切り捨て）。
 * @param taxableTotalIncome 課税総所得金額（円）
 */
export function residentTaxLevy(taxableTotalIncome: number): number {
  return Math.floor(clampNonNeg(taxableTotalIncome) * RESIDENT_TAX_LEVY_RATE);
}

export type FurusatoResult = {
  /** 全額控除される寄付額の上限（円、1円未満切り捨て） */
  limit: number;
  /** 個人住民税所得割額（円） */
  residentLevy: number;
  /** 適用された所得税の限界税率 */
  marginalRate: number;
};

/**
 * ふるさと納税の控除上限額（自己負担2,000円で済む年間寄付額の目安）を、
 * 課税総所得金額から計算する（総務省の式そのまま）。
 *
 * @param taxableTotalIncome 課税総所得金額（円）。源泉徴収票・住民税決定通知書の
 *   「課税総所得金額（課税標準）」に相当。
 */
export function calcFurusatoLimit(taxableTotalIncome: number): FurusatoResult {
  const residentLevy = residentTaxLevy(taxableTotalIncome);
  const marginalRate = marginalIncomeTaxRate(taxableTotalIncome);
  if (residentLevy <= 0) {
    return { limit: 0, residentLevy: 0, marginalRate };
  }
  const denominator =
    RESIDENT_BASIC_CREDIT_RATE - marginalRate * RECONSTRUCTION_TAX_MULTIPLIER;
  const raw = (residentLevy * 0.2) / denominator + SELF_PAYMENT;
  return { limit: Math.floor(raw), residentLevy, marginalRate };
}

// ============================================================
// 年収からの概算（給与所得者・課税総所得金額の見積り）
// ============================================================

/**
 * 社会保険料の概算率（従業員負担・年収に対する目安）。
 *
 * ※この 14.75% は tedori の令和7年度時点の内訳（健保5%＋厚年9.15%＋雇用0.6%）に由来する
 *   独立した literal で、tedori/rates.ts を import していない。令和8年度の確認値では
 *   健保4.95%＋厚年9.15%＋雇用0.5%＋子ども・子育て支援金0.115% ＝ 14.715% であり、
 *   本ツールの値は 0.035pt だけ高い。ふるさと納税の限度額への影響は年収500万で数十円規模のため
 *   即時の実害はないが、料率の二重管理であることに変わりはない。
 *   rates.ts への一本化は furusato 側の記事の限度額とテストの一斉更新を伴うため、
 *   本ツール単独の改修として別途行う（tedori の料率統一のスコープ外）。
 */
const SOCIAL_INSURANCE_ESTIMATE_RATE = 0.1475;
/** 基礎控除（所得税・令和7年分以降の一般的な額） */
const BASIC_DEDUCTION = 480_000;
/** 配偶者控除・扶養控除（一般の控除対象1人あたり、所得税） */
const DEPENDENT_DEDUCTION = 380_000;

/**
 * 給与所得控除額（令和7年分以降・最低65万円）。
 * tool-factory の tedori ツールと同一仕様を共有（モノレポ集約の利点）。
 * ※重複実装を避けるため tedori の純関数を再利用する。
 */
import { salaryIncomeDeduction } from "../tedori/calculations";

export type SalaryEstimateInput = {
  /** 額面年収（円） */
  annualIncome: number;
  /** 配偶者控除の対象がいるか（一般） */
  hasSpouse?: boolean;
  /** 一般の扶養控除対象人数（配偶者を除く） */
  dependents?: number;
  /**
   * その他の所得控除の合計（円・任意）。iDeCo（小規模企業共済等掛金控除）・医療費控除・
   * 生命保険料控除など、基礎控除・配偶者/扶養控除以外で課税所得を下げる控除の合算。
   * 指定すると課税総所得金額がその分下がり、ふるさと納税の限度額も下がる（D3）。
   */
  otherDeductions?: number;
};

/**
 * 額面年収から課税総所得金額を概算する（給与所得者向け・あくまで目安）。
 *
 * 課税総所得金額（概算）= 給与所得 − 社会保険料控除(概算) − 基礎控除 − 配偶者/扶養控除
 *   給与所得 = 年収 − 給与所得控除
 *
 * ⚠ 社会保険料は年収の概算率で見積もる簡易計算。iDeCo・生命保険料控除・医療費控除等は
 *   含まないため、実際の課税総所得金額とは差が出ます。正確に出すには課税総所得金額を
 *   直接入力してください（calcFurusatoLimit）。
 */
export function estimateTaxableIncomeFromSalary(input: SalaryEstimateInput): number {
  const income = clampNonNeg(input.annualIncome);
  if (income <= 0) return 0;
  const employmentIncome = Math.max(0, income - salaryIncomeDeduction(income));
  const socialInsurance = Math.round(income * SOCIAL_INSURANCE_ESTIMATE_RATE);
  const spouse = input.hasSpouse ? DEPENDENT_DEDUCTION : 0;
  const dependents = clampNonNeg(input.dependents ?? 0) * DEPENDENT_DEDUCTION;
  const other = clampNonNeg(input.otherDeductions ?? 0);
  const taxable = Math.max(
    0,
    employmentIncome - socialInsurance - BASIC_DEDUCTION - spouse - dependents - other,
  );
  // 課税総所得金額は1,000円未満切り捨て
  return Math.floor(taxable / 1000) * 1000;
}

/**
 * 額面年収（＋家族構成）から控除上限額を概算する便利関数。
 * 内部で課税総所得金額を見積もり calcFurusatoLimit を適用する。
 */
export function estimateFurusatoLimitFromSalary(
  input: SalaryEstimateInput,
): FurusatoResult & { estimatedTaxableIncome: number } {
  const estimatedTaxableIncome = estimateTaxableIncomeFromSalary(input);
  return { estimatedTaxableIncome, ...calcFurusatoLimit(estimatedTaxableIncome) };
}
