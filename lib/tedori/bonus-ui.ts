/**
 * 賞与の手取りを画面から使うための橋渡し（auto-backlog H2）。
 *
 * `lib/tedori/bonus.ts`（E14）は源泉徴収の告示別表第三まで作り込んであるが、
 * どの画面からも呼ばれておらず、賞与の手取りは記事の中でしか読めなかった
 * （tool-factory#149 の未接続監査で検出）。
 *
 * この層が持つのは「計算できないケースを例外でなく表示可能な形に直す」ことだけ。
 * bonus.ts は**誤った税額を返さずに例外を投げる**設計なので、UI 側で握りつぶすと
 * その設計が無意味になる。理由をユーザーに出すために、理由コードへ変換する。
 */

import {
  calculateBonusNetPay,
  requiresMonthlyTableMethod,
  type BonusNetPayInput,
  type BonusNetPayResult,
} from './bonus';

/** 算出率の表が使えない理由（告示別表第三 備考4）。 */
export type BonusUnsupportedReason = 'noPreviousSalary' | 'bonusOverTenTimes';

export type BonusOutcome =
  | { kind: 'ok'; result: BonusNetPayResult }
  | { kind: 'unsupported'; reason: BonusUnsupportedReason };

/** 理由ごとの説明文（画面とテストで共有する）。 */
export const BONUS_UNSUPPORTED_MESSAGE: Record<BonusUnsupportedReason, string> = {
  noPreviousSalary:
    '前月の給与がない場合は、賞与の算出率の表ではなく月額表を使った計算になります（賞与に対する源泉徴収税額の算出率の表・備考4）。本ツールは月額表に未対応のため、税額を出せません。',
  bonusOverTenTimes:
    '賞与（社会保険料控除後）が前月の給与（社会保険料控除後）の10倍を超える場合は、算出率の表ではなく月額表を使った計算になります（同 備考4）。本ツールは月額表に未対応のため、税額を出せません。',
};

/**
 * 画面から呼ぶ入口。計算できる場合は結果を、できない場合は理由を返す。
 * 例外を握りつぶして0円や概算を返さない（誤った税額を出さないための設計を保つ）。
 */
export function bonusOutcome(input: BonusNetPayInput): BonusOutcome {
  if (requiresMonthlyTableMethod(input)) {
    const reason: BonusUnsupportedReason =
      Math.floor(input.previousMonthSalary) <= 0 ? 'noPreviousSalary' : 'bonusOverTenTimes';
    return { kind: 'unsupported', reason };
  }
  return { kind: 'ok', result: calculateBonusNetPay(input) };
}
