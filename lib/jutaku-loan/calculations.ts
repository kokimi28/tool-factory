/**
 * 住宅ローン控除（住宅借入金等特別控除）の計算ロジック。
 *
 * 令和4年度税制改正後・令和6年（2024年）入居基準:
 *   - 控除率: 0.7%（全区分共通）
 *   - 控除期間: 新築・買取再販 = 13年 / 既存（中古）住宅 = 10年
 *   - 各年の控除額 = min(その年の年末ローン残高, 借入限度額) × 0.7%
 *   - 借入限度額は住宅の環境性能で変わる（下表）。
 *
 * 出典: 国税庁 タックスアンサー No.1211-1「住宅の新築等をし、令和4年以降に居住の用に
 *       供した場合（住宅借入金等特別控除）」。最終確認日: 2026-07-24。
 *
 * ⚠ 本計算は概算・目安です。実際に受けられる控除は、その年の所得税額＋住民税からの
 *    控除上限（課税総所得金額×5%・最大97,500円）が上限になります（＝残高×0.7% を
 *    使い切れないこともある）。所得要件（合計所得2,000万円以下）・床面積要件・
 *    入居年による限度額の違いは考慮しきれないため、詳細は国税庁・税務署でご確認ください。
 */

const DEDUCTION_RATE = 0.007; // 控除率 0.7%
const NEW_BUILD_YEARS = 13; // 新築・買取再販の控除期間
const EXISTING_YEARS = 10; // 既存（中古）住宅の控除期間

/** 住宅の種類（借入限度額の区分）。 */
export type HousingType =
  | "long_term" // 認定長期優良住宅・低炭素住宅（新築）
  | "zeh" // ZEH水準省エネ住宅（新築）
  | "energy_saving" // 省エネ基準適合住宅（新築）
  | "existing_certified" // 既存・認定住宅等（中古）
  | "existing_other"; // 既存・その他（中古）

/**
 * 借入限度額（年末残高の上限・円）。令和6年入居。
 * 新築は「一般」と「子育て世帯・若者夫婦世帯」で異なる（2024入居の上乗せ）。
 * 既存（中古）住宅は世帯による上乗せなし。
 */
const BORROWING_LIMITS: Record<
  HousingType,
  { general: number; childRearing: number; isNewBuild: boolean }
> = {
  long_term: { general: 45_000_000, childRearing: 50_000_000, isNewBuild: true },
  zeh: { general: 35_000_000, childRearing: 45_000_000, isNewBuild: true },
  energy_saving: { general: 30_000_000, childRearing: 40_000_000, isNewBuild: true },
  existing_certified: { general: 30_000_000, childRearing: 30_000_000, isNewBuild: false },
  existing_other: { general: 20_000_000, childRearing: 20_000_000, isNewBuild: false },
};

function clampNonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 住宅の種類・世帯から借入限度額（円）を返す。 */
export function borrowingLimit(
  housingType: HousingType,
  childRearingHousehold: boolean,
): number {
  const row = BORROWING_LIMITS[housingType];
  return childRearingHousehold ? row.childRearing : row.general;
}

/** 控除期間（年）。新築13年・既存10年。 */
export function deductionYears(housingType: HousingType): number {
  return BORROWING_LIMITS[housingType].isNewBuild ? NEW_BUILD_YEARS : EXISTING_YEARS;
}

/**
 * 元利均等返済の毎月返済額（円、1円未満切り捨て）。
 * @param principal 借入額（円）
 * @param annualRatePercent 年利（%）
 * @param years 返済期間（年）
 */
export function monthlyPayment(
  principal: number,
  annualRatePercent: number,
  years: number,
): number {
  const P = clampNonNeg(principal);
  const n = Math.round(clampNonNeg(years) * 12);
  if (P <= 0 || n <= 0) return 0;
  const r = clampNonNeg(annualRatePercent) / 100 / 12;
  if (r === 0) return Math.floor(P / n);
  const pow = Math.pow(1 + r, n);
  return Math.floor((P * r * pow) / (pow - 1));
}

/**
 * 元利均等返済で t か月返済した後のローン残高（円、1円未満切り捨て）。
 * 毎月返済額は monthlyPayment（切り捨て後）を用いる。
 */
export function remainingBalanceAtMonth(
  principal: number,
  annualRatePercent: number,
  years: number,
  monthsElapsed: number,
): number {
  const P = clampNonNeg(principal);
  const n = Math.round(clampNonNeg(years) * 12);
  const t = Math.min(Math.round(clampNonNeg(monthsElapsed)), n);
  if (P <= 0 || n <= 0 || t <= 0) return t >= n ? 0 : Math.floor(P);
  // 完済（返済期間の満了）時点で残高0（最終回で端数を精算する実務に合わせる。
  // 簡易な整数丸めの累積残差を残さない）。
  if (t >= n) return 0;
  const r = clampNonNeg(annualRatePercent) / 100 / 12;
  const M = monthlyPayment(P, annualRatePercent, years);
  let balance = P;
  for (let i = 0; i < t; i++) {
    const interest = Math.floor(balance * r);
    const principalPaid = M - interest;
    balance = balance - principalPaid;
    if (balance < 0) balance = 0;
  }
  return Math.floor(balance);
}

export type HomeLoanInput = {
  /** 借入額（円） */
  principal: number;
  /** 年利（%） */
  annualRatePercent: number;
  /** 返済期間（年） */
  years: number;
  /** 住宅の種類（借入限度額・控除期間を決める） */
  housingType: HousingType;
  /** 子育て世帯・若者夫婦世帯（2024入居の限度額上乗せ・新築のみ効く） */
  childRearingHousehold?: boolean;
};

export type HomeLoanYear = {
  /** 控除年（1〜） */
  year: number;
  /** その年の年末ローン残高（円） */
  yearEndBalance: number;
  /** 控除の対象となる残高（min(残高, 借入限度額)） */
  eligibleBalance: number;
  /** その年の控除額（円、100円未満切り捨て） */
  deduction: number;
};

export type HomeLoanResult = {
  /** 借入限度額（円） */
  limit: number;
  /** 控除期間（年） */
  years: number;
  /** 各年の内訳 */
  schedule: HomeLoanYear[];
  /** 控除見込み総額（円） */
  totalDeduction: number;
  /** 毎月返済額（円） */
  monthlyPayment: number;
};

/**
 * 住宅ローン控除の各年・総額の控除見込みを計算する。
 * 各年の控除額 = min(年末残高, 借入限度額) × 0.7%（100円未満切り捨て）。
 */
export function calcHomeLoanDeduction(input: HomeLoanInput): HomeLoanResult {
  const limit = borrowingLimit(input.housingType, input.childRearingHousehold ?? false);
  const years = deductionYears(input.housingType);
  const payment = monthlyPayment(input.principal, input.annualRatePercent, input.years);

  const schedule: HomeLoanYear[] = [];
  let total = 0;
  for (let y = 1; y <= years; y++) {
    const yearEndBalance = remainingBalanceAtMonth(
      input.principal,
      input.annualRatePercent,
      input.years,
      y * 12,
    );
    const eligibleBalance = Math.min(yearEndBalance, limit);
    // 控除額は100円未満切り捨て（税額控除の慣例）
    const deduction = Math.floor((eligibleBalance * DEDUCTION_RATE) / 100) * 100;
    schedule.push({ year: y, yearEndBalance, eligibleBalance, deduction });
    total += deduction;
  }

  return {
    limit,
    years,
    schedule,
    totalDeduction: total,
    monthlyPayment: payment,
  };
}
