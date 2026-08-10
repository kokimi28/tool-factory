/**
 * iDeCo受取税ツールの URL 共有ヘルパー（E3・2巡目）。
 * 多フィールドの受取条件（西暦×金額）を短いクエリキーに相互変換する純関数。
 * 入力値のエンコード／デコードは共通の share-url ヘルパーを使う。
 */
import type { IdecoPresetInputs } from "./presets";

/** RawInputs（Calculator の入力）→ クエリ用の短いキーの map。 */
export function encodeIdecoInputs(raw: IdecoPresetInputs): Record<string, string> {
  return {
    nyusha: raw.nyushaYear,
    taishoku: raw.taishokuYear,
    tman: raw.taishokuMan,
    istart: raw.idecoStartYear,
    irecv: raw.idecoReceiptYear,
    iman: raw.idecoMan,
    iend: raw.idecoEndYear,
  };
}

/** クエリの map → RawInputs の部分更新（存在するキーのみ）。 */
export function decodeIdecoInputs(p: Record<string, string>): Partial<IdecoPresetInputs> {
  const out: Partial<IdecoPresetInputs> = {};
  if (p.nyusha != null) out.nyushaYear = p.nyusha;
  if (p.taishoku != null) out.taishokuYear = p.taishoku;
  if (p.tman != null) out.taishokuMan = p.tman;
  if (p.istart != null) out.idecoStartYear = p.istart;
  if (p.irecv != null) out.idecoReceiptYear = p.irecv;
  if (p.iman != null) out.idecoMan = p.iman;
  if (p.iend != null) out.idecoEndYear = p.iend;
  return out;
}
