/**
 * iDeCo の「一時金」と「年金」を同じ土俵で比べる（auto-backlog G3）。
 *
 * 記事 ideco-lump-sum-vs-pension は一時金側だけを実額（加入15年・800万円で税151,050円）で
 * 示し、年金側は「公的年金等控除が使える」「控除の二重取りに近い効果が得られることがあります」
 * と定性的に書くだけで、FAQ も「一律の正解はありません」で止まっていた。
 *
 * だが年金側も計算できる。iDeCo を年金で受け取ると**公的年金等の雑所得**になり、
 * 公的年金等控除の枠を公的年金と共有する（所得税法35条3項）。つまり
 *
 *     iDeCo年金の税負担 ＝ （公的年金 ＋ iDeCo年金）の税 − （公的年金だけ）の税
 *
 * という差分で求まる。控除も税率も D12 で実装済み（lib/nenkin-kuriage/net.ts）なので、
 * 併給する公的年金の額を入力に取れば実額で比較できる。
 *
 * ─────────────────────────────────────────────────────────────
 *  この比較で分かること（テストで向きを固定している）
 * ─────────────────────────────────────────────────────────────
 *  - 退職所得控除が残っているなら一時金が強い。2分の1課税も効くため、
 *    公的年金と重なる時期に年金で受け取ると税負担は跳ね上がる。
 *  - 逆に**退職所得控除を退職金で使い切っていて、かつ公的年金と重ならない時期
 *    （60〜64歳など）に受け取れる**なら、年金受取が勝つことがある。
 *    「控除の二重取りに近い効果」が実際に効くのはこの条件のときで、
 *    条件を書かずに一般論として書くと読者を誤らせる。
 *
 *  ※ 一時金側は既存の lib/ideco/calculations.ts（退職所得控除・2分の1課税・速算表）、
 *    年金側は lib/nenkin-kuriage/net.ts（公的年金等控除・所得税・住民税）を再利用する。
 *    どちらも条文を実測して作った実装で、ここでは組み合わせるだけ（式を書き直さない）。
 */

import { pensionNet } from '../nenkin-kuriage/net';

import {
  calcIncomeTax,
  calcResidentTax,
  calcRetirementDeduction,
  calcTaxableIncome,
} from './calculations';

const nonNeg = (n: number | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

export interface LumpSumOutcome {
  /** 受取額（円） */
  amount: number;
  /** 適用された退職所得控除額（円） */
  deduction: number;
  /** 課税退職所得金額（円・1,000円未満切捨・2分の1課税後） */
  taxableIncome: number;
  /** 所得税（復興特別所得税込み・円） */
  incomeTax: number;
  /** 住民税（円） */
  residentTax: number;
  /** 税の合計（円） */
  totalTax: number;
  /** 手取り（円） */
  net: number;
}

/** 受給1年ぶんの内訳（年齢で控除が変わるので年ごとに持つ）。 */
export interface AnnuityYear {
  /** その年の本人の年齢 */
  age: number;
  /** その年に併給する公的年金（円） */
  publicPension: number;
  /** iDeCo を受け取ることで増える税（円） */
  extraTax: number;
}

export interface AnnuityOutcome {
  /** 受取総額（円） */
  amount: number;
  /** 分割年数 */
  years: number;
  /** 1年あたりの iDeCo 年金額（円） */
  perYear: number;
  /** 年ごとの内訳 */
  schedule: readonly AnnuityYear[];
  /** 受給期間中の税の合計（円） */
  totalTax: number;
  /** 手取り（円） */
  net: number;
}

export interface ReceiptComparison {
  lumpSum: LumpSumOutcome;
  annuity: AnnuityOutcome;
  /** 手取りが多いほう */
  winner: 'lumpSum' | 'annuity' | 'tie';
  /** 勝ったほうが多く受け取れる額（円・0以上） */
  differenceInNet: number;
}

export interface ReceiptComparisonInput {
  /** iDeCo の受取総額（円） */
  idecoAmount: number;
  /** iDeCo の加入年数（退職所得控除の年数） */
  contributionYears: number;
  /**
   * 退職金などで既に使った退職所得控除額（円）。
   * 勤務先の退職金を先に一時金で受け取っていると、その分だけ枠が減る。
   */
  retirementDeductionAlreadyUsed?: number;
  /** 年金で受け取る場合の分割年数（既定5年） */
  annuityYears?: number;
  /** 併給する公的年金の年額（円・既定0）。publicPensionStartAge 以降の年だけ効く。 */
  publicPensionPerYear?: number;
  /** iDeCo を年金で受け取り始める年齢（既定65） */
  receiptStartAge?: number;
  /** 公的年金の受給開始年齢（既定65）。この年齢から publicPensionPerYear が乗る。 */
  publicPensionStartAge?: number;
}

/** iDeCo を一時金で受け取ったときの税と手取り。 */
export function lumpSumOutcome(input: ReceiptComparisonInput): LumpSumOutcome {
  const amount = nonNeg(input.idecoAmount);
  const full = calcRetirementDeduction(Math.max(0, Math.floor(input.contributionYears)));
  // 退職金で使った分だけ枠が減る（0未満にはならない）
  const deduction = Math.max(0, full - nonNeg(input.retirementDeductionAlreadyUsed));
  const taxableIncome = calcTaxableIncome(amount, deduction);
  const incomeTax = calcIncomeTax(taxableIncome);
  const residentTax = calcResidentTax(taxableIncome);
  const totalTax = incomeTax + residentTax;
  return { amount, deduction, taxableIncome, incomeTax, residentTax, totalTax, net: amount - totalTax };
}

/**
 * iDeCo を年金で受け取ったときの税と手取り。
 *
 * iDeCo年金は公的年金等の雑所得なので、公的年金と控除の枠を共有する。
 * そのため「公的年金＋iDeCo」の税から「公的年金だけ」の税を引いた差＝iDeCo の負担になる。
 */
export function annuityOutcome(input: ReceiptComparisonInput): AnnuityOutcome {
  const amount = nonNeg(input.idecoAmount);
  const years = Math.max(1, Math.floor(input.annuityYears ?? 5));
  const perYear = amount / years;
  const publicPension = nonNeg(input.publicPensionPerYear);
  const startAge = input.receiptStartAge ?? 65;
  const pensionStartAge = input.publicPensionStartAge ?? 65;

  // 65歳の前後で公的年金等控除の下限が 60万円 / 110万円 と変わり、さらに公的年金の
  // 受給が始まると控除の枠を食い合う。どちらも年齢で変わるので**年ごとに**計算する。
  // （分割年数が65歳をまたぐケースを1つの区分で済ませると、負担を取り違える。）
  const schedule: AnnuityYear[] = [];
  for (let i = 0; i < years; i += 1) {
    const age = startAge + i;
    const pub = age >= pensionStartAge ? publicPension : 0;
    const age65OrOver = age >= 65;
    const withIdeco = pensionNet({ annualPension: pub + perYear, age65OrOver });
    const withoutIdeco = pensionNet({ annualPension: pub, age65OrOver });
    schedule.push({ age, publicPension: pub, extraTax: withIdeco.totalTax - withoutIdeco.totalTax });
  }
  const totalTax = schedule.reduce((a, r) => a + r.extraTax, 0);
  return { amount, years, perYear, schedule, totalTax, net: amount - totalTax };
}

/** 一時金と年金を同じ土俵（手取り）で比べる。 */
export function compareReceiptMethods(input: ReceiptComparisonInput): ReceiptComparison {
  const lump = lumpSumOutcome(input);
  const ann = annuityOutcome(input);
  const diff = lump.net - ann.net;
  return {
    lumpSum: lump,
    annuity: ann,
    winner: diff > 0 ? 'lumpSum' : diff < 0 ? 'annuity' : 'tie',
    differenceInNet: Math.abs(diff),
  };
}
