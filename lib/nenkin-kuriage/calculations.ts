/**
 * 年金 繰上げ・繰下げ 損益分岐シミュレーターの計算ロジック。
 *
 * 老齢年金の受給開始年齢は原則65歳。60〜75歳の範囲で早めたり（繰上げ）遅らせたり
 * （繰下げ）でき、月あたりで受給率が変わる:
 *   - 繰上げ（60〜64歳）: 1か月あたり 0.4% 減額（昭和37年4月2日以降生まれ）。最大 60歳＝−24%。
 *   - 繰下げ（66〜75歳）: 1か月あたり 0.7% 増額。最大 75歳＝+84%。
 *
 * 早く始めると月額は少ないが受給期間が長く、遅く始めると月額は多いが期間が短い。
 * 累計受給額が等しくなる年齢＝損益分岐年齢を求める。
 *
 * 出典: 日本年金機構「年金の繰上げ受給／繰下げ受給」。最終確認日: 2026-07-24。
 * ⚠ 本計算は概算・目安です。加給年金・振替加算・在職老齢年金・税/社会保険料は考慮していません。
 */

const STANDARD_AGE = 65;
const MIN_AGE = 60;
const MAX_AGE = 75;
const EARLY_RATE_PER_MONTH = 0.004; // 繰上げ 0.4%/月 減額
const DEFER_RATE_PER_MONTH = 0.007; // 繰下げ 0.7%/月 増額

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 65歳を基準とした受給開始月数の差（繰上げは負・繰下げは正）。
 * @param startAge 受給開始年齢（60〜75、月単位の端数も可）
 */
export function monthsFrom65(startAge: number): number {
  const age = clamp(startAge, MIN_AGE, MAX_AGE);
  return Math.round((age - STANDARD_AGE) * 12);
}

/**
 * 適用される1か月あたりの増減率（繰上げ 0.4%／繰下げ 0.7%）。
 * @param startAge 受給開始年齢
 */
export function ratePerMonth(startAge: number): number {
  return monthsFrom65(startAge) < 0 ? EARLY_RATE_PER_MONTH : DEFER_RATE_PER_MONTH;
}

/**
 * 受給開始年齢に対する受給率（65歳＝1.0）。
 * @param startAge 受給開始年齢（60〜75、月単位の端数も可）
 */
export function pensionRate(startAge: number): number {
  const months = monthsFrom65(startAge);
  return 1 + ratePerMonth(startAge) * months;
}

/**
 * 受給開始年齢での年金月額（円、1円未満切り捨て）。
 * @param baseMonthlyAt65 65歳で受け取る場合の年金月額（円）
 */
export function monthlyPension(baseMonthlyAt65: number, startAge: number): number {
  const base = Math.max(0, baseMonthlyAt65);
  return Math.floor(base * pensionRate(startAge));
}

/**
 * 受給開始から指定年齢時点までの累計受給額（円）。
 * 月額 × 受給月数（開始年齢〜指定年齢）。指定年齢が開始前なら0。
 */
export function cumulativePension(
  baseMonthlyAt65: number,
  startAge: number,
  atAge: number,
): number {
  const monthly = monthlyPension(baseMonthlyAt65, startAge);
  const months = Math.max(0, Math.round((atAge - clamp(startAge, MIN_AGE, MAX_AGE)) * 12));
  return monthly * months;
}

export type BreakEven = {
  /** 損益分岐年齢（年・端数は月）。null は分岐しない（同率）。 */
  ageYears: number | null;
  /** 損益分岐年齢の「歳」部分 */
  years: number | null;
  /** 端数の月数（0〜11） */
  months: number | null;
};

/**
 * 選んだ受給開始年齢と、標準の65歳受給との損益分岐年齢を求める。
 *
 * 累計が等しくなる年齢 t: mSel×(t−sSel) = m65×(t−65)
 *   → t = (mSel×sSel − m65×65) / (mSel − m65)
 * （月額は基準額に比例するので分岐年齢は基準額に依らない＝率だけで決まる）
 *
 * @param startAge 比較したい受給開始年齢（60〜75）
 */
export function breakEvenAgeVs65(startAge: number): BreakEven {
  const sSel = clamp(startAge, MIN_AGE, MAX_AGE);
  const rateSel = pensionRate(sSel);
  const rate65 = 1;
  if (rateSel === rate65) return { ageYears: null, years: null, months: null };
  // 基準額1として率で解く（分岐年齢は基準額に依らない）。
  const t = (rateSel * sSel - rate65 * STANDARD_AGE) / (rateSel - rate65);
  const years = Math.floor(t);
  const months = Math.round((t - years) * 12);
  // 端数月が12になった場合の繰り上げ
  const normYears = months >= 12 ? years + 1 : years;
  const normMonths = months >= 12 ? months - 12 : months;
  return { ageYears: t, years: normYears, months: normMonths };
}

export type PensionScenario = {
  startAge: number;
  rate: number;
  monthly: number;
  annual: number;
};

/**
 * 受給開始年齢のシナリオ（率・月額・年額）を返す。
 */
export function pensionScenario(
  baseMonthlyAt65: number,
  startAge: number,
): PensionScenario {
  const monthly = monthlyPension(baseMonthlyAt65, startAge);
  return {
    startAge: clamp(startAge, MIN_AGE, MAX_AGE),
    rate: pensionRate(startAge),
    monthly,
    annual: monthly * 12,
  };
}
