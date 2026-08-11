/**
 * 入力バリデーション（E9・2巡目）。QC12 の `parseNonNegativeNumber` は不正値を静かに 0 に
 * 落とすが、E9 では「なぜ 0 になったか」を利用者に伝えるための検証結果（値＋エラーメッセージ）を返す。
 * 税額そのものは扱わず、入力の妥当性だけを判定する純関数（誤値リスクなし）。
 */

/** 全角数字・全角ピリオドを半角へ（input.ts と同じ規則）。 */
function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".");
}

export type NumberValidation = {
  /** 計算に渡す正規化済みの値（エラー時も安全側の値を返す）。 */
  value: number;
  /** 利用者向けエラーメッセージ。問題なければ null。 */
  error: string | null;
};

export type ValidateOptions = {
  /** 許容する最小値（既定 0）。 */
  min?: number;
  /** 許容する最大値（省略時は上限なし）。 */
  max?: number;
};

/**
 * 数値入力を検証し、正規化値と分かりやすいエラーメッセージを返す。
 * - 空文字は「未入力」としてエラーにしない（value=min）。
 * - 数字として解釈できない → エラー（value=min）。
 * - 最小値未満 → エラー（value=min にクランプ）。
 * - 最大値超過 → エラー（value=max にクランプ）。
 */
export function validateNumberInput(raw: string, opts: ValidateOptions = {}): NumberValidation {
  const min = opts.min ?? 0;
  const { max } = opts;

  const cleaned = toHalfWidth(raw).replace(/[,，\s]/g, "");
  if (cleaned === "") return { value: min, error: null };

  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    return { value: min, error: "数字で入力してください。" };
  }
  if (n < min) {
    return { value: min, error: `${min.toLocaleString("ja-JP")} 以上で入力してください。` };
  }
  if (max !== undefined && n > max) {
    return {
      value: max,
      error: `${max.toLocaleString("ja-JP")} 以内で入力してください。`,
    };
  }
  return { value: n, error: null };
}
