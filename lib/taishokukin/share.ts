/**
 * 退職金課税ツールの URL 共有ヘルパー（E3・2巡目）。
 * 退職理由・真偽フラグをクエリ文字列に安全に相互変換する純関数。
 * 入力値のエンコード／デコードは共通の share-url ヘルパーを使う。
 */
import type { SeparationReason } from "./calculations";

/** クエリ値 → 退職理由。未知の値は "voluntary"（自己都合）にフォールバック。 */
export function parseSeparation(s: string): SeparationReason {
  return s === "involuntary" ? "involuntary" : "voluntary";
}

/** 真偽 → クエリ用フラグ（"1" | "0"）。 */
export function boolToFlag(b: boolean): string {
  return b ? "1" : "0";
}

/** クエリ用フラグ → 真偽（"1" のときだけ true）。 */
export function flagToBool(s: string): boolean {
  return s === "1";
}
