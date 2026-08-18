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
export function calcFurusatoLimit(
  taxableTotalIncome: number,
  options: {
    /**
     * 調整控除の額（円）。住民税所得割額は調整控除を引いたあとの額なので、
     * 家族構成が分かっている呼び出し（年収からの概算）ではこれを渡す。
     * 課税総所得金額だけを直接入力する使い方では家族構成が不明なため0のままでよい。
     */
    adjustmentCredit?: number;
  } = {},
): FurusatoResult {
  const credit = clampNonNeg(options.adjustmentCredit ?? 0);
  const residentLevy = Math.max(0, residentTaxLevy(taxableTotalIncome) - credit);
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
 * 住民税の基礎控除（円）。地方税法第314条の2第2項（合計所得2,400万円以下で43万円）。
 *
 * ⚠ ここを「所得税の基礎控除（令和7年改正後は58万〜95万）」に差し替えないこと。
 *   一度そう修正しようとして誤りだと分かったので理由を残す。
 *
 *   総務省「ふるさと納税ポータルサイト（控除額の計算）」によれば、特例分の計算に使う
 *   所得税の税率は「個人住民税の課税総所得金額から人的控除差調整額を差し引いた金額により
 *   求めた所得税の税率」であり、**住民税ベース**の金額で決まる。所得税の基礎控除とは別物。
 *
 *   以前は住民税ベースの人的控除も調整控除も持たない簡易モデルだったため、43万と58〜95万の
 *   中間にあたる 48万 を近似として使っていた（当時のコメントに「本格的にやるなら
 *   人的控除差調整額のモデル化が必要（未実施）」と記録されていた）。
 *   それを実施したのが本ファイルの `personalDeductionDifference` /
 *   `residentTaxAdjustmentCredit` で、近似は不要になったので条文どおりの43万円に戻した。
 */
const BASIC_DEDUCTION_RESIDENT = 430_000;

/**
 * 人的控除の差（調整控除の加算額）。地方税法第37条・第314条の6。
 *
 * 所得税と住民税で人的控除の額が違うぶん、住民税の課税所得だけが大きくなる。
 * その差を税額から取り戻すのが調整控除で、差額の表は条文に列挙されている。
 * 基礎控除5万円／控除対象配偶者5万円／扶養親族 一般5万円・特定18万円・老人10万円。
 * （特定18万円 ＝ 所得税63万 − 住民税45万 と一致する＝表の内部整合）
 */
export const PERSONAL_DEDUCTION_DIFFERENCE = {
  basic: 50_000,
  spouse: 50_000,
  dependentGeneral: 50_000,
  dependentSpecific: 180_000,
  dependentElderly: 100_000,
} as const;

/**
 * 調整控除の率。市町村民税3%（指定都市4%）＋道府県民税2%（指定都市1%）で
 * **合計は指定都市かどうかに関わらず5%**（地方税法314条の6・37条）。
 */
const ADJUSTMENT_CREDIT_RATE = 0.05;
/** 調整控除の計算が切り替わる合計課税所得金額（200万円）。 */
const ADJUSTMENT_CREDIT_THRESHOLD = 2_000_000;
/** 200万円超のときの下限（5万円）。 */
const ADJUSTMENT_CREDIT_FLOOR = 50_000;

/**
 * 給与所得控除額（令和7年分以降・最低65万円）。
 * tool-factory の tedori ツールと同一仕様を共有（モノレポ集約の利点）。
 * ※重複実装を避けるため tedori の純関数を再利用する。
 */
import { salaryIncomeDeduction } from "../tedori/calculations";
import { RATE_EMP } from "../tedori/rates";

/** 住民税の配偶者控除・扶養控除（地方税法314条の2第1項10号・11号）。 */
const DEPENDENT_DEDUCTION_RESIDENT = {
  spouse: 330_000,
  general: 330_000,
  specific: 450_000,
  elderly: 380_000,
} as const;

/**
 * 人的控除の差の合計（調整控除の加算額）。
 * 基礎控除ぶんは誰にでもあるので常に加算する。
 */
export function personalDeductionDifference(input: {
  hasSpouse?: boolean;
  dependents?: number;
  specificDependents?: number;
  elderlyDependents?: number;
}): number {
  const d = PERSONAL_DEDUCTION_DIFFERENCE;
  return (
    d.basic +
    (input.hasSpouse ? d.spouse : 0) +
    clampNonNeg(input.dependents ?? 0) * d.dependentGeneral +
    clampNonNeg(input.specificDependents ?? 0) * d.dependentSpecific +
    clampNonNeg(input.elderlyDependents ?? 0) * d.dependentElderly
  );
}

/**
 * 調整控除の額（円）。地方税法第37条・第314条の6。
 *
 *   合計課税所得金額 ≦ 200万円 … min(人的控除差の合計, 合計課税所得金額) × 5%
 *   合計課税所得金額 > 200万円 … max(人的控除差の合計 −(合計課税所得金額 − 200万円), 5万円) × 5%
 *
 * これは**所得控除ではなく税額控除**（所得割の額から直接引く）。課税所得を動かす形で
 * 近似すると、限度額の分子（住民税所得割額）を取り違える。
 */
export function residentTaxAdjustmentCredit(
  taxableTotalIncome: number,
  personalDifference: number,
): number {
  const taxable = clampNonNeg(taxableTotalIncome);
  const diff = clampNonNeg(personalDifference);
  if (taxable <= 0) return 0;
  const base =
    taxable <= ADJUSTMENT_CREDIT_THRESHOLD
      ? Math.min(diff, taxable)
      : Math.max(diff - (taxable - ADJUSTMENT_CREDIT_THRESHOLD), ADJUSTMENT_CREDIT_FLOOR);
  return Math.floor(base * ADJUSTMENT_CREDIT_RATE);
}

export type SalaryEstimateInput = {
  /** 額面年収（円） */
  annualIncome: number;
  /** 配偶者控除の対象がいるか（一般） */
  hasSpouse?: boolean;
  /** 一般の扶養控除対象人数（16〜18歳・23〜69歳。配偶者を除く） */
  dependents?: number;
  /** 特定扶養親族（19〜22歳）の人数。住民税45万円・調整控除の差18万円。 */
  specificDependents?: number;
  /** 老人扶養親族（70歳以上）の人数。住民税38万円・調整控除の差10万円。 */
  elderlyDependents?: number;
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
  // ふるさと納税の限度額は住民税所得割額から決まるので、人的控除は**住民税の額**を使う
  // （地方税法314条の2。所得税の額を使うと課税所得を過小に見て限度額がずれる）。
  const spouse = input.hasSpouse ? DEPENDENT_DEDUCTION_RESIDENT.spouse : 0;
  const dependents =
    clampNonNeg(input.dependents ?? 0) * DEPENDENT_DEDUCTION_RESIDENT.general +
    clampNonNeg(input.specificDependents ?? 0) * DEPENDENT_DEDUCTION_RESIDENT.specific +
    clampNonNeg(input.elderlyDependents ?? 0) * DEPENDENT_DEDUCTION_RESIDENT.elderly;
  const other = clampNonNeg(input.otherDeductions ?? 0);
  const taxable = Math.max(
    0,
    employmentIncome - socialInsurance - BASIC_DEDUCTION_RESIDENT - spouse - dependents - other,
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
  // 住民税所得割額は調整控除を引いたあとの額。家族構成が分かるこの経路では反映する。
  const adjustmentCredit = residentTaxAdjustmentCredit(
    estimatedTaxableIncome,
    personalDeductionDifference(input),
  );
  return {
    estimatedTaxableIncome,
    ...calcFurusatoLimit(estimatedTaxableIncome, { adjustmentCredit }),
  };
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

// ============================================================
// 所得控除のトレードオフ（限度額は下がるが税は減る）
// ============================================================

/**
 * 所得控除1円あたりの節税額の内訳。
 *
 * 所得控除は所得税と住民税の両方の課税所得を下げるので、節税額は
 *   控除額 ×（住民税の所得割10% ＋ 所得税の限界税率 × 1.021）
 * になる（1.021 は復興特別所得税込み）。ふるさと納税の限度額の式と同じ材料で出せる。
 */
export function deductionTaxSaving(
  deduction: number,
  taxableTotalIncome: number,
): { incomeTax: number; residentTax: number; total: number; marginalRate: number } {
  const amount = clampNonNeg(deduction);
  const marginalRate = marginalIncomeTaxRate(taxableTotalIncome);
  const incomeTax = Math.floor(amount * marginalRate * RECONSTRUCTION_TAX_MULTIPLIER);
  const residentTax = Math.floor(amount * RESIDENT_TAX_LEVY_RATE);
  return { incomeTax, residentTax, total: incomeTax + residentTax, marginalRate };
}

export interface DeductionTradeoff {
  /** 追加した所得控除の額（円） */
  deduction: number;
  /** 控除前のふるさと納税 控除上限額（円） */
  limitBefore: number;
  /** 控除後のふるさと納税 控除上限額（円） */
  limitAfter: number;
  /** 限度額の目減り（円） */
  limitDecrease: number;
  /** その控除による節税額（円） */
  taxSaving: number;
  /** 節税額 − 限度額の目減り（円）。プラスなら控除を使ったほうが得。 */
  netGain: number;
  /** 節税額が限度額の目減りの何倍か */
  ratio: number;
}

/**
 * 「所得控除を使うとふるさと納税の限度額が下がって損なのか」に数字で答える。
 *
 * 記事は「iDeCoによる節税効果のほうが…通常は大きく、トータルでは有利です」と
 * 定性的に書くだけで額を示せていなかった。限度額の目減りも節税額も同じ材料
 * （課税総所得金額と限界税率）から出せるので、比較して返す。
 *
 * @param taxableTotalIncome 控除を使う前の課税総所得金額（円）
 * @param deduction          追加する所得控除の額（円）
 */
export function deductionTradeoff(
  taxableTotalIncome: number,
  deduction: number,
): DeductionTradeoff {
  const before = clampNonNeg(taxableTotalIncome);
  const amount = clampNonNeg(deduction);
  const after = Math.max(0, before - amount);
  const limitBefore = calcFurusatoLimit(before).limit;
  const limitAfter = calcFurusatoLimit(after).limit;
  const limitDecrease = Math.max(0, limitBefore - limitAfter);
  const taxSaving = deductionTaxSaving(amount, before).total;
  return {
    deduction: amount,
    limitBefore,
    limitAfter,
    limitDecrease,
    taxSaving,
    netGain: taxSaving - limitDecrease,
    ratio: limitDecrease > 0 ? taxSaving / limitDecrease : Number.POSITIVE_INFINITY,
  };
}
