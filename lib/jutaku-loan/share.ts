/**
 * 住宅ローン控除ツールの URL 共有ヘルパー（E3・2巡目）。
 * 住宅種別・真偽フラグをクエリ文字列に安全に相互変換する純関数。
 * 入力値のエンコード／デコードは共通の share-url ヘルパーを使う。
 */
import type { HousingType } from "./calculations";

const HOUSING_TYPES: HousingType[] = [
  "long_term",
  "zeh",
  "energy_saving",
  "existing_certified",
  "existing_other",
];

/** クエリ値 → 住宅種別。未知の値は "zeh"（既定）にフォールバック。 */
export function parseHousingType(s: string): HousingType {
  return (HOUSING_TYPES as string[]).includes(s) ? (s as HousingType) : "zeh";
}

/** 真偽 → クエリ用フラグ（"1" | "0"）。 */
export function boolToFlag(b: boolean): string {
  return b ? "1" : "0";
}

/** クエリ用フラグ → 真偽（"1" のときだけ true）。 */
export function flagToBool(s: string): boolean {
  return s === "1";
}
