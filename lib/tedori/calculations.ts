/**
 * 給与（年収）の手取り額を概算する計算ロジック。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠・出典（税・控除の最終確認日: 2026-07-13）
 * ─────────────────────────────────────────────────────────────
 *  【所得税】
 *  - 給与所得控除（令和7年分以降・最低保障65万円）: 所得税法別表第五 / 国税庁 No.1410
 *      https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm
 *  - 基礎控除（令和7年度税制改正・合計所得金額別。令和7〜8年分の上乗せを反映）: 国税庁
 *      https://www.nta.go.jp/users/gensen/2025kiso/index.htm
 *  - 所得税の速算表（税率5〜45%）: 国税庁 No.2260
 *  - 復興特別所得税: 基準所得税額の2.1%（2013〜2037年）
 *  【住民税】※前年所得に対して課税されるため、本ツールは当年所得ベースの概算
 *  - 標準税率10%（市町村民税6%＋道府県民税4%）＋均等割5,000円（森林環境税1,000円含む）
 *  - 基礎控除43万円。地方税法。調整控除は簡略化のため未計上（数千円の差）。
 *  【社会保険料（従業員負担）】協会けんぽ・一般の事業・令和8年度
 *  - 料率と標準報酬月額の上限は **rates.ts が単一の正**（出典 URL・最終確認日もそこ）。
 *    賞与側（bonus.ts）と同じ定数を import するため、料率が片側だけ古くなることはない。
 *  - 本ファイル固有の近似: 標準報酬月額の等級表を用いず、年収に上限を当てて料率を掛ける。
 *    また健保・介護・支援金は健康保険法第156条第1項第1号では「1本の保険料額」だが、
 *    ここでは内訳ごとに Math.round する（年収ベースの概算なので円単位の厳密さに意味がない。
 *    標準賞与額が確定額である賞与側は、bonus.ts が合算1回丸めを厳密に実装している）。
 *
 *  ※料率・控除額は毎年改定され、都道府県・事業の種類・扶養状況で変わります。
 *    本ツールは扶養なし・単一の給与収入を前提とした概算であり、結果はあくまで参考値です。
 */
import {
  RATE_EMP,
  MONTHLY_CAP,
  asFraction,
  prefectureHealthRateEmpP100K,
  type Prefecture,
} from "./rates";

/** ユーザー入力 */
export interface NetSalaryInput {
  /** 年収（額面・賞与含む・円） */
  annualIncome: number;
  /** 40歳以上65歳未満か（介護保険料の対象） */
  isOver40: boolean;
  /**
   * 勤務先の適用事業所がある都道府県（協会けんぽ支部）。
   * 未指定なら全国平均の健康保険料率を使う。健康保険料率だけが都道府県で変わる。
   */
  prefecture?: Prefecture;
}

/** 計算結果（内訳つき・すべて年額の円） */
export interface NetSalaryResult {
  /** 健康保険料（従業員負担） */
  healthInsurance: number;
  /** 介護保険料（従業員負担・40〜64歳のみ） */
  nursingInsurance: number;
  /** 厚生年金保険料（従業員負担） */
  pensionInsurance: number;
  /** 雇用保険料（従業員負担） */
  employmentInsurance: number;
  /** 子ども・子育て支援金（従業員負担・令和8年4月分〜。標準報酬月額にもかかる） */
  childCareSupportLevy: number;
  /** 社会保険料合計 */
  socialInsurance: number;
  /** 給与所得控除額 */
  salaryDeduction: number;
  /** 給与所得（年収 − 給与所得控除） */
  employmentIncome: number;
  /** 課税所得（所得税・1000円未満切捨後） */
  taxableIncomeForIncomeTax: number;
  /** 所得税（復興特別所得税を含む） */
  incomeTax: number;
  /** 住民税（概算） */
  residentTax: number;
  /** 税・社会保険料の合計（＝年収 − 手取り） */
  totalDeduction: number;
  /** 手取り額（年額） */
  takeHome: number;
  /** 手取り月額の目安（手取り年額 ÷ 12） */
  takeHomeMonthly: number;
  /** 手取り率（手取り ÷ 年収） */
  takeHomeRate: number;
}

// ── 上限・控除の定数 ──
// 料率は rates.ts が単一の正（RATE_EMP）。改定時は rates.ts だけを更新する。
const KENKO_ANNUAL_CAP = MONTHLY_CAP.health * 12; // 健保・介護・支援金 標準報酬月額上限139万円 × 12
const KOSEI_ANNUAL_CAP = MONTHLY_CAP.pension * 12; // 厚年 標準報酬月額上限65万円 × 12
const BASIC_DEDUCTION_RESIDENT = 430_000; // 住民税の基礎控除
const JUMINZEI_KINTOWARI = 5_000; // 住民税 均等割（森林環境税含む）

/** 1,000円未満切捨（課税所得・標準賞与額の共通処理） */
export const floorTo1000 = (v: number): number => Math.floor(v / 1000) * 1000;
/** 入力の正規化（非数・負値は0とみなす） */
export const clampNonNeg = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * 給与所得控除額（令和7年分以降）。
 * 最低保障65万円、上限195万円。国税庁 No.1410。
 * ※給与収入660万円未満は本来「別表第五」を用いるが、本ツールは速算表による概算。
 */
export function salaryIncomeDeduction(income: number): number {
  const y = clampNonNeg(income);
  if (y <= 1_900_000) return 650_000;
  if (y <= 3_600_000) return Math.floor(y * 0.3) + 80_000;
  if (y <= 6_600_000) return Math.floor(y * 0.2) + 440_000;
  if (y <= 8_500_000) return Math.floor(y * 0.1) + 1_100_000;
  return 1_950_000;
}

/**
 * 所得税の基礎控除（令和7年度税制改正・合計所得金額別。令和7〜8年分の上乗せを反映）。
 * 2,350万円超は改正がなく、従来どおり2,400万円超で逓減し2,500万円超で0。
 */
export function basicDeductionIncomeTax(totalIncome: number): number {
  const t = clampNonNeg(totalIncome);
  if (t <= 1_320_000) return 950_000;
  if (t <= 3_360_000) return 880_000;
  if (t <= 4_890_000) return 680_000;
  if (t <= 6_550_000) return 630_000;
  if (t <= 23_500_000) return 580_000;
  if (t <= 24_000_000) return 480_000;
  if (t <= 24_500_000) return 320_000;
  if (t <= 25_000_000) return 160_000;
  return 0;
}

/**
 * 所得税の速算表（課税所得 → 税額・復興前）。国税庁 No.2260。
 * 税率は整数（%）で計算し浮動小数点の誤差を避ける。
 */
export function incomeTaxByBracket(taxable: number): number {
  const t = clampNonNeg(taxable);
  if (t <= 1_949_000) return (t * 5) / 100;
  if (t <= 3_299_000) return (t * 10) / 100 - 97_500;
  if (t <= 6_949_000) return (t * 20) / 100 - 427_500;
  if (t <= 8_999_000) return (t * 23) / 100 - 636_000;
  if (t <= 17_999_000) return (t * 33) / 100 - 1_536_000;
  if (t <= 39_999_000) return (t * 40) / 100 - 2_796_000;
  return (t * 45) / 100 - 4_796_000;
}

/**
 * 社会保険料（従業員負担・年額）を求める。
 * 標準報酬月額の等級表は用いず、年収に上限を適用した概算。
 *
 * 子ども・子育て支援金（令和8年4月分〜）は健康保険料と同じ標準報酬月額が土台なので、
 * 健保・介護と同じ上限（139万円/月）を当てる。雇用保険だけは上限がなく年収の全額が基礎。
 */
export function socialInsurance(
  income: number,
  isOver40: boolean,
  prefecture?: Prefecture,
) {
  const y = clampNonNeg(income);
  const healthBase = Math.min(y, KENKO_ANNUAL_CAP);
  // 都道府県で変わるのは健康保険料率だけ。介護・支援金・厚年・雇用保険は全国一律。
  // prefecture 未指定なら全国平均（＝従来どおりの挙動）。
  const health = Math.round(
    healthBase * asFraction(prefectureHealthRateEmpP100K(prefecture)),
  );
  const nursing = isOver40 ? Math.round(healthBase * RATE_EMP.nursing) : 0;
  const pension = Math.round(Math.min(y, KOSEI_ANNUAL_CAP) * RATE_EMP.pension);
  const childCare = Math.round(healthBase * RATE_EMP.childCare);
  const employment = Math.round(y * RATE_EMP.employment);
  return {
    health,
    nursing,
    pension,
    childCare,
    employment,
    total: health + nursing + pension + childCare + employment,
  };
}

/**
 * 年収から手取り額を概算する（メイン関数）。
 */
export function calculateNetSalary(input: NetSalaryInput): NetSalaryResult {
  const income = clampNonNeg(input.annualIncome);

  // 社会保険料
  const si = socialInsurance(income, input.isOver40, input.prefecture);

  // 給与所得
  const salaryDeduction = salaryIncomeDeduction(income);
  const employmentIncome = Math.max(0, income - salaryDeduction);

  // 所得税
  const basicIt = basicDeductionIncomeTax(employmentIncome);
  const taxableIt = floorTo1000(Math.max(0, employmentIncome - si.total - basicIt));
  const incomeTaxBase = Math.floor(incomeTaxByBracket(taxableIt));
  const incomeTax = Math.floor((incomeTaxBase * 1021) / 1000); // 復興特別所得税込み・1円未満切捨

  // 住民税（概算）: 所得割10%（100円未満切捨）＋ 均等割
  const taxableRt = floorTo1000(Math.max(0, employmentIncome - si.total - BASIC_DEDUCTION_RESIDENT));
  const residentLevy = Math.floor(taxableRt / 1000) * 100; // = taxableRt × 10% を100円未満切捨
  const residentTax = taxableRt > 0 ? residentLevy + JUMINZEI_KINTOWARI : 0;

  const totalDeduction = si.total + incomeTax + residentTax;
  const takeHome = income - totalDeduction;

  return {
    healthInsurance: si.health,
    nursingInsurance: si.nursing,
    pensionInsurance: si.pension,
    employmentInsurance: si.employment,
    childCareSupportLevy: si.childCare,
    socialInsurance: si.total,
    salaryDeduction,
    employmentIncome,
    taxableIncomeForIncomeTax: taxableIt,
    incomeTax,
    residentTax,
    totalDeduction,
    takeHome,
    takeHomeMonthly: Math.round(takeHome / 12),
    takeHomeRate: income > 0 ? takeHome / income : 0,
  };
}
