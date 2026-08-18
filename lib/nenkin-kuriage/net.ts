/**
 * 年金の手取り（税引後）と、手取りベースの損益分岐（auto-backlog D12）。
 *
 * これまで本ツールの損益分岐は**額面**だけで計算しており、記事も
 * 「具体的な税額・保険料は他の所得・自治体・世帯構成で変わるため、一律には示せません」
 * と書いて定量化を避けていた。だが実際には**税（所得税・復興特別所得税・住民税）は
 * 法律で一意に決まる**。自治体で変わるのは国民健康保険料・介護保険料と住民税の
 * 均等割・非課税限度額だけなので、そこだけ引数に出せば残りは正確に計算できる。
 *
 * したがって本ファイルの方針は
 *   - 法律で決まる部分（公的年金等控除・所得税・住民税所得割）＝ 計算する
 *   - 自治体・世帯で変わる部分（国保/介護保険料・均等割・非課税限度額）＝ 引数（既定は標準）
 * とし、「出せないから示さない」を「入力を分けて出す」に置き換える。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠（最終確認日: 2026-08-18・e-Gov 法令 API の条文を実測）
 * ─────────────────────────────────────────────────────────────
 *  ■ 公的年金等控除額 … 所得税法 第35条第4項（昭和40年法律第33号）
 *      公的年金等以外の合計所得金額に応じ「イ ＋ ロ」（下限あり）:
 *        イ: 1,000万円以下 40万円 ／ 1,000万円超2,000万円以下 30万円 ／ 2,000万円超 20万円
 *        ロ: 残額 ＝ 収入金額 − 50万円 として
 *            残額 ≤ 360万円            → 残額 × 25%
 *            360万円 < 残額 ≤ 720万円  → 90万円 ＋ (残額 − 360万円) × 15%
 *            720万円 < 残額 ≤ 950万円  → 144万円 ＋ (残額 − 720万円) × 5%
 *            950万円 <  残額           → 155万5千円
 *        下限（65歳未満）: 60万円 ／ 50万円 ／ 40万円
 *
 *  ■ 65歳以上の最低控除額の特例 … 租税特別措置法 第41条の15の3第1項
 *      上記の下限を「60万円→110万円」「50万円→100万円」「40万円→90万円」と読み替える。
 *      同条第4項: 65歳以上かどうかの判定は**その年の12月31日**の年齢による。
 *
 *  ■ 所得税の速算表・基礎控除 … lib/tedori/calculations.ts を正として再利用（重複定義しない）
 *  ■ 復興特別所得税 … 所得税額 × 2.1%（東日本大震災からの復興のための施策を実施するために
 *      必要な財源の確保に関する特別措置法 第13条）
 *
 *  ■ 住民税所得割の標準税率 … 地方税法 第35条（道府県民税 4%）＋ 第314条の3（市町村民税 6%）＝ 10%
 *  ■ 住民税の基礎控除 … 地方税法 第314条の2第2項
 *      合計所得金額 2,400万円以下 43万円 ／ 2,450万円以下 29万円 ／ 2,500万円以下 15万円 ／ 超は0
 *      （所得税の基礎控除とは別。令和7年度改正で引き上げられたのは所得税側だけ）
 *  ■ 住民税均等割の標準税率 … 地方税法 第38条（道府県民税 1,000円）＋ 第310条（市町村民税 3,000円）
 *      実務ではこれに森林環境税（国税）1,000円が併せて賦課徴収されるため合計5,000円。
 *      ただし超過課税を行う自治体があるため引数で差し替えられるようにしている。
 *  ■ 住民税均等割の非課税限度額 … 地方税法 第295条第3項＋同法施行令 第47条の3
 *      「基本額（35万円に級地区分の率を乗じた額を参酌）×（本人＋同一生計配偶者＋扶養親族の数）
 *        ＋ 10万円（＋扶養がある場合の加算額）」を**市町村の条例で定める**。
 *      単身・級地1（率1.0）なら 35万円 ＋ 10万円 ＝ 45万円。条例事項なので既定値であり定数ではない。
 *
 *  ※ 国民健康保険料・介護保険料は保険者ごとに料率・段階が異なり、法律から一意に出せない。
 *    そのため定額部分 `socialInsurance`（円/年）と所得比例部分 `socialInsuranceRate`（率）を
 *    引数に取り、既定はどちらも0（＝税だけの手取り）とする。渡された額は社会保険料控除として
 *    所得税・住民税の課税標準からも差し引く。
 *
 *    定額と比例を分けているのは、両者で損益分岐の動く向きが違うため。
 *      - 定額部分（均等割など）は年金が少ない側に相対的に重く効くので、分岐を**早める**。
 *      - 比例部分（所得割など）は率としては中立で、残るのは社会保険料控除による税の軽減だけ。
 *        効果は小さく、年齢によって符号も変わる（ほぼ中立）。
 *    つまり税が分岐を後ろへ動かすのに対し、保険料は少なくとも後ろへは動かさない。実際の国保・介護は
 *    均等割＋所得割＋賦課限度額＋段階別と保険者ごとに形が違うので、
 *    **保険料込みの分岐がどちらに動くかは自治体の料率を入れないと決まらない**。
 *    本ファイルが保険料を既定0にして「税だけの手取り」を返すのはこのため。
 */

import { basicDeductionIncomeTax, incomeTaxByBracket } from '../tedori/calculations';

import { monthlyPension } from './calculations';

/** 最終的に条文を確認した日。 */
export const NET_LAW_CHECKED_AT = '2026-08-18';

/** 復興特別所得税の税率（所得税額に対する上乗せ）。 */
export const RECONSTRUCTION_SURTAX_RATE = 0.021;

/** 住民税の標準値（地方税法）。均等割と非課税限度額は自治体で変わるため既定値扱い。 */
export const RESIDENT_TAX = {
  /** 所得割の標準税率（道府県4% ＋ 市町村6%） */
  levyRate: 0.1,
  /** 均等割（道府県1,000円 ＋ 市町村3,000円 ＋ 森林環境税1,000円）の既定値 */
  perCapita: 5_000,
  /** 均等割の非課税限度額の既定値（単身・級地1: 35万円 ＋ 10万円） */
  exemptionLimit: 450_000,
} as const;

const nonNeg = (n: number | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

/** 住民税の基礎控除（地方税法 第314条の2第2項）。所得税のものとは別表。 */
export function basicDeductionResidentTax(totalIncome: number): number {
  const t = nonNeg(totalIncome);
  if (t <= 24_000_000) return 430_000;
  if (t <= 24_500_000) return 290_000;
  if (t <= 25_000_000) return 150_000;
  return 0;
}

/** 課税標準の1,000円未満切捨て（国税通則法118条1項・地方税法20条の4の2第1項）。 */
const floorTo1000 = (n: number): number => Math.floor(n / 1_000) * 1_000;
/** 税額の100円未満切捨て（国税通則法119条1項・地方税法20条の4の2第3項）。 */
const floorTo100 = (n: number): number => Math.floor(n / 100) * 100;

/**
 * 公的年金等控除額（円/年）。所得税法35条4項＋措置法41条の15の3。
 *
 * @param revenue     その年の公的年金等の収入金額（円）
 * @param age65OrOver その年の12月31日時点で65歳以上か（措置法41条の15の3第4項）
 * @param otherIncome 公的年金等に係る雑所得以外の合計所得金額（円）
 */
export function publicPensionDeduction(
  revenue: number,
  age65OrOver: boolean,
  otherIncome = 0,
): number {
  const rev = nonNeg(revenue);
  const other = nonNeg(otherIncome);

  // イ: 他の所得の多さで 40 / 30 / 20 万円
  const partA = other <= 10_000_000 ? 400_000 : other <= 20_000_000 ? 300_000 : 200_000;
  // 下限: 65歳未満 60 / 50 / 40 万円。65歳以上は措置法で +50万円の読み替え。
  const floorBase = other <= 10_000_000 ? 600_000 : other <= 20_000_000 ? 500_000 : 400_000;
  const floor = age65OrOver ? floorBase + 500_000 : floorBase;

  // ロ: 収入から50万円を引いた「残額」の累進
  const rest = Math.max(0, rev - 500_000);
  let partB: number;
  if (rest <= 3_600_000) partB = rest * 0.25;
  else if (rest <= 7_200_000) partB = 900_000 + (rest - 3_600_000) * 0.15;
  else if (rest <= 9_500_000) partB = 1_440_000 + (rest - 7_200_000) * 0.05;
  else partB = 1_555_000;

  // 控除は収入を超えない（雑所得は負にならない）。
  return Math.min(rev, Math.max(partA + partB, floor));
}

/** 公的年金等に係る雑所得の金額（円/年）。 */
export function publicPensionMiscIncome(
  revenue: number,
  age65OrOver: boolean,
  otherIncome = 0,
): number {
  const rev = nonNeg(revenue);
  return Math.max(0, rev - publicPensionDeduction(rev, age65OrOver, otherIncome));
}

export interface PensionNetInput {
  /** その年の公的年金等の収入金額（円/年・額面） */
  annualPension: number;
  /** その年の12月31日時点で65歳以上か（既定 true） */
  age65OrOver?: boolean;
  /** 公的年金等に係る雑所得以外の合計所得金額（円/年・既定0） */
  otherIncome?: number;
  /**
   * 国民健康保険料・介護保険料などのうち、所得によらない定額部分の年額（円）。
   * 保険者ごとに異なり法律から一意に出せないため引数。既定0（＝税だけの手取り）。
   */
  socialInsurance?: number;
  /**
   * 同じく、年金収入に比例する部分の料率（0〜1）。既定0。
   *
   * 国保・介護は「均等割（定額）＋ 所得割（所得比例）」の形なので、定額だけで
   * 近似すると**年金が少ない人ほど重く**なり、繰下げが実際より有利に見えてしまう。
   * 所得比例部分を率で渡せるようにしているのはこのため。
   */
  socialInsuranceRate?: number;
  /** 住民税の均等割（円/年）。超過課税の自治体があるため差し替え可能。 */
  residentPerCapita?: number;
  /** 住民税均等割の非課税限度額（円）。条例事項のため差し替え可能。 */
  residentExemptionLimit?: number;
}

export interface PensionNetResult {
  /** 額面（円/年） */
  gross: number;
  /** 公的年金等控除額（円/年） */
  pensionDeduction: number;
  /** 公的年金等に係る雑所得（円/年） */
  miscIncome: number;
  /** 社会保険料（引数そのまま・円/年） */
  socialInsurance: number;
  /** 所得税（復興特別所得税込み・円/年） */
  incomeTax: number;
  /** 住民税の所得割（円/年） */
  residentLevy: number;
  /** 住民税の均等割（円/年）。非課税限度額以下なら0。 */
  residentPerCapita: number;
  /** 住民税の合計（円/年） */
  residentTax: number;
  /** 税の合計（所得税＋住民税・円/年） */
  totalTax: number;
  /** 手取り（額面 − 税 − 社会保険料・円/年） */
  net: number;
  /** 額面に対する手取りの割合（0〜1） */
  netRatio: number;
}

/**
 * 公的年金の手取り（円/年）を求める。
 *
 * 社会保険料を渡さない既定の呼び出しでは「税引後」の手取りになる。
 * 国保・介護保険料は自治体で変わるため、必要な人だけ実額を渡す設計にしている。
 */
export function pensionNet(input: PensionNetInput): PensionNetResult {
  const gross = nonNeg(input.annualPension);
  const age65OrOver = input.age65OrOver ?? true;
  const otherIncome = nonNeg(input.otherIncome);
  const social =
    nonNeg(input.socialInsurance) + gross * Math.min(1, nonNeg(input.socialInsuranceRate));
  const perCapitaBase = input.residentPerCapita ?? RESIDENT_TAX.perCapita;
  const exemptionLimit = input.residentExemptionLimit ?? RESIDENT_TAX.exemptionLimit;

  const pensionDeduction = publicPensionDeduction(gross, age65OrOver, otherIncome);
  const miscIncome = Math.max(0, gross - pensionDeduction);
  // 合計所得金額（公的年金等の雑所得 ＋ それ以外）。基礎控除の判定に使う。
  const totalIncome = miscIncome + otherIncome;

  // 所得税: 課税総所得金額 ＝ 合計所得 − 社会保険料控除 − 基礎控除（1,000円未満切捨）
  const incomeTaxable = floorTo1000(
    Math.max(0, totalIncome - social - basicDeductionIncomeTax(totalIncome)),
  );
  const incomeTax = floorTo100(
    incomeTaxByBracket(incomeTaxable) * (1 + RECONSTRUCTION_SURTAX_RATE),
  );

  // 住民税: 基礎控除が所得税と別（43万円）。所得割は100円未満切捨。
  const residentTaxable = floorTo1000(
    Math.max(0, totalIncome - social - basicDeductionResidentTax(totalIncome)),
  );
  const residentLevy = floorTo100(residentTaxable * RESIDENT_TAX.levyRate);
  // 均等割は合計所得金額が非課税限度額以下なら課されない（地方税法295条3項）。
  const residentPerCapita = totalIncome <= exemptionLimit ? 0 : perCapitaBase;
  const residentTax = residentLevy + residentPerCapita;

  const totalTax = incomeTax + residentTax;
  const net = Math.max(0, gross - totalTax - social);

  return {
    gross,
    pensionDeduction,
    miscIncome,
    socialInsurance: social,
    incomeTax,
    residentLevy,
    residentPerCapita,
    residentTax,
    totalTax,
    net,
    netRatio: gross > 0 ? net / gross : 0,
  };
}

/** 手取り計算のうち、開始年齢によらず共通の前提（税以外の入力）。 */
export type PensionNetOptions = Omit<PensionNetInput, 'annualPension' | 'age65OrOver'>;

/**
 * その年の手取り（円/年）。
 *
 * 65歳未満と65歳以上で公的年金等控除の下限が 60万円 / 110万円 と変わる
 * （措置法41条の15の3・判定はその年の12月31日の年齢）ため、**受け取っている
 * 本人の年齢**を渡す必要がある。繰上げ受給（60〜64歳）はこの差がそのまま
 * 手取りに効くので、開始年齢だけで一律に扱ってはいけない。
 *
 * @param baseMonthlyAt65 65歳時点の年金月額（円）
 * @param startAge        受給開始年齢（受給額を決める）
 * @param atAge           その年の本人の年齢（65歳未満/以上の判定に使う）
 */
export function annualNetAt(
  baseMonthlyAt65: number,
  startAge: number,
  atAge: number,
  options: PensionNetOptions = {},
): PensionNetResult {
  const annual = monthlyPension(baseMonthlyAt65, startAge) * 12;
  return pensionNet({ ...options, annualPension: annual, age65OrOver: atAge >= 65 });
}

/**
 * 受給開始から指定年齢時点までの累計「手取り」（円）。
 *
 * 65歳の前後で控除の下限が変わるので、65歳未満の期間と65歳以上の期間を分けて足す。
 * 1年あたりの手取りを月割りして受給月数を掛ける（額面の cumulativePension と同じ粒度）。
 */
export function cumulativeNetPension(
  baseMonthlyAt65: number,
  startAge: number,
  atAge: number,
  options: PensionNetOptions = {},
): number {
  if (atAge <= startAge) return 0;
  const underEnd = Math.min(atAge, Math.max(startAge, 65)); // 65歳未満で受給した区間の終わり
  const monthsUnder = Math.max(0, Math.round((underEnd - startAge) * 12));
  const monthsOver = Math.max(0, Math.round((atAge - underEnd) * 12));
  const under = annualNetAt(baseMonthlyAt65, startAge, 60, options).net;
  const over = annualNetAt(baseMonthlyAt65, startAge, 65, options).net;
  return (under / 12) * monthsUnder + (over / 12) * monthsOver;
}

export type NetBreakEven = {
  /** 手取りベースの損益分岐年齢（小数） */
  ageYears: number | null;
  /** 「歳」部分 */
  years: number | null;
  /** 端数の月数（0〜11） */
  months: number | null;
  /** 比較した開始年齢の、65歳以降の年間手取り（円） */
  selectedAnnualNet: number;
  /** 65歳受給の年間手取り（円） */
  standardAnnualNet: number;
  /** 65歳になるまでに受け取り終えた手取りの累計（円）。繰下げなら0。 */
  netBefore65: number;
};

/**
 * 手取り（税引後）での損益分岐年齢を、65歳受給と比べて求める。
 *
 * 額面の `breakEvenAgeVs65` は受給率だけで決まり基準額に依らないが、手取りは
 * 公的年金等控除・基礎控除・累進税率が効くため**基準額に依存する**。
 * そのため額面版と違い `baseMonthlyAt65` が必須になる。
 *
 * 65歳以降の直線区間で解く（分岐は必ず65歳より後にくる）:
 *   netBefore65 ＋ nSel×(t − a) ＝ n65×(t − 65)   （a ＝ max(開始年齢, 65)）
 *   → t ＝ (nSel×a − n65×65 − netBefore65) / (nSel − n65)
 */
export function breakEvenAgeVs65Net(
  baseMonthlyAt65: number,
  startAge: number,
  options: PensionNetOptions = {},
): NetBreakEven {
  const a = Math.max(startAge, 65);
  const nSel = annualNetAt(baseMonthlyAt65, startAge, 65, options).net;
  const n65 = annualNetAt(baseMonthlyAt65, 65, 65, options).net;
  const netBefore65 = cumulativeNetPension(baseMonthlyAt65, startAge, 65, options);
  const base = { selectedAnnualNet: nSel, standardAnnualNet: n65, netBefore65 };
  if (nSel === n65) return { ageYears: null, years: null, months: null, ...base };

  const t = (nSel * a - n65 * 65 - netBefore65) / (nSel - n65);
  const rawYears = Math.floor(t);
  const rawMonths = Math.round((t - rawYears) * 12);
  const years = rawMonths >= 12 ? rawYears + 1 : rawYears;
  const months = rawMonths >= 12 ? rawMonths - 12 : rawMonths;
  return { ageYears: t, years, months, ...base };
}

/** 画面が必要とする「開始年齢ごとの手取り」の一式。 */
export interface NetScenario {
  startAge: number;
  /** 受給を始めた年の手取り（60〜64歳開始なら65歳未満の控除で計算される） */
  atStart: PensionNetResult;
  /** 65歳以降の年の手取り */
  from65: PensionNetResult;
  /** 65歳前後で手取りが変わるか（＝繰上げで控除の下限が変わるか） */
  differsBefore65: boolean;
  /** 手取りベースの損益分岐 */
  breakEven: NetBreakEven;
}

/**
 * 画面表示用に、開始年齢ごとの手取りと損益分岐をまとめて返す。
 *
 * 繰上げ（60〜64歳開始）は受給開始時点では65歳未満の控除（下限60万円）が適用され、
 * 65歳になると下限110万円に変わって手取りが増える。同じ額面でも年で手取りが違うので
 * 両方を返し、画面はその差を隠さずに出す。
 */
export function netScenario(
  baseMonthlyAt65: number,
  startAge: number,
  options: PensionNetOptions = {},
): NetScenario {
  const atStart = annualNetAt(baseMonthlyAt65, startAge, startAge, options);
  const from65 = annualNetAt(baseMonthlyAt65, startAge, 65, options);
  return {
    startAge,
    atStart,
    from65,
    differsBefore65: atStart.net !== from65.net,
    breakEven: breakEvenAgeVs65Net(baseMonthlyAt65, startAge, options),
  };
}
