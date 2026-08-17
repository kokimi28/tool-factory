/**
 * 在職老齢年金の支給停止額（auto-backlog D5）。
 *
 * 厚生年金に加入しながら老齢厚生年金を受け取ると、賃金と年金の合計が基準額を超えた分の
 * 半分だけ年金が止まる。止まるのは老齢厚生年金だけで、老齢基礎年金は調整対象外。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠・数値（最終確認日: 2026-08-17・一次資料を実測）
 * ─────────────────────────────────────────────────────────────
 *  日本年金機構「在職老齢年金制度が改正されました」
 *    https://www.nenkin.go.jp/tokusetsu/zairoukaisei.html
 *
 *  - 令和8年3月以前（令和7年度）: 支給停止調整額 **51万円**
 *  - 令和8年4月以降（令和8年度）: **65万円** に引き上げ
 *  - 計算式（引用）:
 *      合計が基準額以下 → 全額支給
 *      合計が基準額を超える → 基本月額 −（基本月額 ＋ 総報酬月額相当額 − 基準額）÷ 2
 *  - 基本月額 = 加給年金額を除いた老齢厚生年金（報酬比例部分）の年額 ÷ 12
 *  - 総報酬月額相当額 = 標準報酬月額 ＋ 直近1年間の標準賞与額 ÷ 12
 *  - 老齢基礎年金は調整の対象にならない
 *  - 基準額は**毎年度、賃金の変動に応じて改定される**（同ページ注4）
 *
 *  ※ 一次資料に載っている検算用の例（本ファイルのテストで固定している）:
 *    基本月額10万円・総報酬月額相当額46万円 のとき
 *      改正前（51万円）: 10 −（10 + 46 − 51）÷ 2 = 7.5万円（2.5万円が停止）
 *      改正後（65万円）: 合計56万円 ≤ 65万円 なので全額支給（停止なし）
 *
 *  ※ 「毎年度改定される」ため、この定数は年度をまたぐたびに要確認。
 *    asOf を必須にしているのは、施行日をまたいだ瞬間に黙って答えが変わるのを防ぐため。
 */

/** 支給停止調整額の1改定分。 */
export interface SuspensionThresholdRow {
  /** 適用開始日（YYYY-MM-DD） */
  from: string;
  /** 支給停止調整額（円/月） */
  threshold: number;
  /** 年度ラベル（記事の表記と突き合わせる） */
  label: string;
}

/** 支給停止調整額の改定履歴（円/月）。施行日の昇順で持つ。 */
export const SUSPENSION_THRESHOLD_SCHEDULE: readonly SuspensionThresholdRow[] = [
  /** 令和7年度（〜令和8年3月） */
  { from: '0000-01-01', threshold: 510_000, label: '令和7年度' },
  /** 令和8年4月〜（令和8年度） */
  { from: '2026-04-01', threshold: 650_000, label: '令和8年度' },
];

export interface ZaishokuInput {
  /**
   * 基本月額（円/月）。加給年金額を除いた老齢厚生年金（報酬比例部分）の年額 ÷ 12。
   * 老齢基礎年金は含めない（調整対象外のため）。
   */
  basicMonthly: number;
  /**
   * 総報酬月額相当額（円/月）。標準報酬月額 ＋ 直近1年間の標準賞与額 ÷ 12。
   */
  totalCompensationMonthly: number;
}

export interface ZaishokuResult {
  /** 判定に使った支給停止調整額（円/月） */
  threshold: number;
  /** 基準額のラベル（例: 令和8年度） */
  thresholdLabel: string;
  /** 基本月額 ＋ 総報酬月額相当額（円/月） */
  combined: number;
  /** 支給停止される額（円/月）。停止なしなら0。基本月額を超えない。 */
  suspended: number;
  /** 実際に支給される老齢厚生年金の月額（円/月） */
  paid: number;
  /** 全部停止されているか（支給額が0） */
  fullySuspended: boolean;
}

const clampNonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/** 判定日時点の支給停止調整額（円/月）とそのラベルを返す。 */
export function suspensionThreshold(asOf: string): { threshold: number; label: string } {
  let current = SUSPENSION_THRESHOLD_SCHEDULE[0]!;
  for (const row of SUSPENSION_THRESHOLD_SCHEDULE) {
    if (asOf >= row.from) current = row;
  }
  return { threshold: current.threshold, label: current.label };
}

/**
 * 在職老齢年金の支給停止額を求める。
 *
 * @param asOf 判定する日（YYYY-MM-DD）。基準額が年度で変わるため必須。
 */
export function zaishokuPensionSuspension(
  input: ZaishokuInput,
  asOf: string,
): ZaishokuResult {
  const basic = clampNonNeg(input.basicMonthly);
  const comp = clampNonNeg(input.totalCompensationMonthly);
  const { threshold, label } = suspensionThreshold(asOf);
  const combined = basic + comp;

  // 基準額以下なら全額支給。超える分の半分だけ止まるが、止まるのは基本月額が上限
  // （年金以上には止まらない＝全部停止で頭打ち）。
  const rawSuspended = combined <= threshold ? 0 : (combined - threshold) / 2;
  const suspended = Math.min(basic, rawSuspended);
  const paid = basic - suspended;

  return {
    threshold,
    thresholdLabel: label,
    combined,
    suspended,
    paid,
    fullySuspended: basic > 0 && paid === 0,
  };
}
