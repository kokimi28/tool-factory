/**
 * 数値入力の安全なパース（QC12・入力バリデーション/エッジケース是正）。
 *
 * 各ツールの Calculator が個別に持っていた `toNumber`（`Number(s.replace(/[,，\s]/g,""))`）は
 * 次のエッジケースを取りこぼしていた:
 *   - 全角数字「１２３」→ Number が解釈できず 0 に落ちる（日本語 IME で普通に起きる）
 *   - 負値「-5」→ そのまま負のまま計算に渡る
 * ここに集約し、全角→半角・桁区切り除去・非有限は 0・負値は 0 にクランプ、を1か所で保証する。
 * 小数点は残すため率（0.7 など）にも使える。金額・年数・人数など「非負の数値入力」に用いる。
 */

/** 全角数字・全角ピリオドを半角へ。 */
function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".");
}

/**
 * 文字列入力を非負の有限数へ正規化する。
 * - 全角数字→半角
 * - 桁区切り（半角/全角カンマ）・空白を除去
 * - 解釈できない（NaN/Infinity）場合は 0
 * - 負値は 0 にクランプ
 * 小数点は保持する。
 */
export function parseNonNegativeNumber(raw: string): number {
  const cleaned = toHalfWidth(raw).replace(/[,，\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

/** value を [min, max] に収める（NaN 安全）。上限のエッジケース是正に用いる。 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
