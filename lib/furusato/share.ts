/**
 * ふるさと納税ツールの URL 共有ヘルパー（E3・2巡目）。
 * 入力モード・真偽フラグをクエリ文字列に安全に相互変換する純関数。
 * 入力値のエンコード／デコードは共通の share-url ヘルパーを使う。
 */
export type Mode = "salary" | "taxable";

/** クエリ値 → 入力モード。未知の値は "salary"（年収から概算）にフォールバック。 */
export function parseMode(s: string): Mode {
  return s === "taxable" ? "taxable" : "salary";
}

/** 真偽 → クエリ用フラグ（"1" | "0"）。 */
export function boolToFlag(b: boolean): string {
  return b ? "1" : "0";
}

/** クエリ用フラグ → 真偽（"1" のときだけ true）。 */
export function flagToBool(s: string): boolean {
  return s === "1";
}
