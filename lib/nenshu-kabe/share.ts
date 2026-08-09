/**
 * 年収の壁ツールの URL 共有マッピング（E3・2巡目）。
 * 壁（106万/130万）をクエリ用の短いコードに相互変換する純関数。
 * 入力値のエンコード／デコードは共通の share-url ヘルパーを使う。
 */
import type { SiWall } from "./calculations";

/** 壁 → クエリ用コード（"106" | "130"）。 */
export function wallToCode(wall: SiWall): string {
  return wall === 1_060_000 ? "106" : "130";
}

/** クエリ用コード → 壁。未知の値は 130万の壁にフォールバック。 */
export function codeToWall(code: string): SiWall {
  return code === "106" ? 1_060_000 : 1_300_000;
}
