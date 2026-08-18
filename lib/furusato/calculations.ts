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
 * tedori の `rates.ts`（料率の単一の正）から導出する。かつては 0.1475 という独立した
 * literal を持っており、tedori が令和8年度へ更新されたあとも取り残されていた
 * （料率の二重管理）。健保4.95%＋厚年9.15%＋雇用0.5%＋子ども・子育て支援金0.115%。
 *
 * ※介護保険料（40〜64歳のみ）は年齢で変わるため概算には含めない。従来の 0.1475 も
 *   含めていなかったので、この点の挙動は変わらない。
 */
const SOCIAL_INSURANCE_ESTIMATE_RATE =
  RATE_EMP.health + RATE_EMP.pension + RATE_EMP.employment + RATE_EMP.childCare;
/**
 * 基礎控除（円）。
 *
 * ⚠ この 480,000 を「令和7年改正の段階的基礎控除（58万〜95万）」に差し替えないこと。
 *   一度そう修正しようとして誤りだと分かったので理由を残す。
 *
 *   総務省「ふるさと納税ポータルサイト（控除額の計算）」によれば、特例分の計算に使う
 *   所得税の税率は「個人住民税の課税総所得金額から人的控除差調整額を差し引いた金額により
 *   求めた所得税の税率」であり、住民税ベースの金額で決まる。住民税の基礎控除は43万円で、
 *   所得税の基礎控除（改正後は58万〜95万）とは別物。
 *
 *   本ツールは住民税ベースの課税総所得金額と人的控除差調整額を持たない簡易モデルなので、
 *   43万と58〜95万の中間にあたる 48万 を近似として使っている。改正後の所得税基礎控除に
 *   差し替えると住民税ベースからかえって遠ざかり、限度額を過小表示する。
 *
 *   正確に出したい利用者向けには、課税総所得金額を直接渡す calcFurusatoLimit がある。
 *   本格的にやるなら人的控除差調整額のモデル化が必要（未実施）。
 */
const BASIC_DEDUCTION = 480_000;
/** 配偶者控除・扶養控除（一般の控除対象1人あたり、所得税） */
const DEPENDENT_DEDUCTION = 380_000;

/**
 * 給与所得控除額（令和7年分以降・最低65万円）。
 * tool-factory の tedori ツールと同一仕様を共有（モノレポ集約の利点）。
 * ※重複実装を避けるため tedori の純関数を再利用する。
 */
import { salaryIncomeDeduction } from "../tedori/calculations";
import { RATE_EMP } from "../tedori/rates";

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

// ============================================================
// 控除の内訳（所得税分・住民税基本分・住民税特例分）
// ============================================================

/**
 * 寄付額に対する控除の内訳。
 *
 * 総務省「ふるさと納税ポータルサイト（控除額の計算）」の3本立てをそのまま実装する
 * （最終確認日: 2026-08-18・一次資料の HTML を実測）:
 *
 *   (1) 所得税からの控除     = (寄付額 − 2,000) × 所得税の税率（復興特別所得税込み）
 *   (2) 住民税からの控除(基本分) = (寄付額 − 2,000) × 10%
 *   (3) 住民税からの控除(特例分) = (寄付額 − 2,000) × (90% − 所得税の税率)
 *       ただし特例分が住民税所得割額の20%を超える場合は (3)' 住民税所得割額 × 20%
 *
 * この内訳が要る理由（D11）: 確定申告で住宅ローン控除と併用すると、(1) の所得税分が
 * 住宅ローン控除と同じ所得税の枠を取り合う。ワンストップ特例なら (1) が発生せず
 * 全額が住民税から控除されるので取り合いが起きない。
 * **「取り合いの対象になる額」＝(1) は本関数で出せる**が、実際にいくら目減りするかは
 * 住宅ローン控除可能額と居住開始年（住民税側の控除上限が変わる）に依存し、
 * 本ツールの入力には無いので算出しない。
 *
 * ※対象寄付額の上限（総所得金額等の40%／30%）は総所得金額等を受け取らないため適用しない。
 *   控除上限額の近辺までの通常の寄付額を想定した内訳である。
 */
export type DeductionBreakdown = {
  /** (1) 所得税からの控除（円）。確定申告時のみ発生し、住宅ローン控除と枠を取り合う。 */
  incomeTaxPortion: number;
  /** (2) 住民税からの控除・基本分（円） */
  residentBasicPortion: number;
  /** (3) 住民税からの控除・特例分（円） */
  residentSpecialPortion: number;
  /** 控除の合計（円） */
  totalDeduction: number;
  /** 実質の自己負担額（円）。上限内なら 2,000 になる。 */
  selfPayment: number;
  /** 特例分が住民税所得割額の20%上限に当たったか（＝自己負担が2,000円を超える） */
  specialPortionCapped: boolean;
};

/**
 * 寄付額と課税総所得金額から控除の内訳を求める。
 *
 * @param donation 寄付額（円）
 * @param taxableTotalIncome 課税総所得金額（円）
 */
export function donationDeductionBreakdown(
  donation: number,
  taxableTotalIncome: number,
): DeductionBreakdown {
  const d = clampNonNeg(donation);
  const base = Math.max(0, d - SELF_PAYMENT);
  const rate = marginalIncomeTaxRate(taxableTotalIncome);
  const rateWithReconstruction = rate * RECONSTRUCTION_TAX_MULTIPLIER;
  const residentLevy = residentTaxLevy(taxableTotalIncome);

  const incomeTaxPortion = Math.floor(base * rateWithReconstruction);
  const residentBasicPortion = Math.floor(base * (1 - RESIDENT_BASIC_CREDIT_RATE));
  const specialUncapped = base * (RESIDENT_BASIC_CREDIT_RATE - rateWithReconstruction);
  const specialCap = residentLevy * 0.2;
  const specialPortionCapped = specialUncapped > specialCap;
  const residentSpecialPortion = Math.floor(
    Math.min(specialUncapped, specialCap),
  );

  const totalDeduction =
    incomeTaxPortion + residentBasicPortion + residentSpecialPortion;
  return {
    incomeTaxPortion,
    residentBasicPortion,
    residentSpecialPortion,
    totalDeduction,
    selfPayment: d - totalDeduction,
    specialPortionCapped,
  };
}
