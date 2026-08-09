/**
 * 年金 繰上げ・繰下げツールの URL 共有ヘルパー（E3・2巡目）。
 * 受給開始年齢の共有値を計算が受け付ける範囲（60〜75歳）に丸める純関数。
 * 入力値のエンコード／デコードは共通の share-url ヘルパーを使う。
 */
const MIN_AGE = 60;
const MAX_AGE = 75;
const DEFAULT_AGE = 65;

/** 共有された受給開始年齢を 60〜75 の整数に丸める。不正値は 65 にフォールバック。 */
export function clampStartAge(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_AGE;
  return Math.min(MAX_AGE, Math.max(MIN_AGE, Math.round(n)));
}
