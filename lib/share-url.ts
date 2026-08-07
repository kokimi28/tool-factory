/**
 * 結果の URL 共有ヘルパー（E3・2巡目）。
 * 計算フォームの入力値をクエリ文字列にエンコード／デコードする純関数。
 * これで「同じ URL を開けば同じ入力＝同じ結果」を再現できる（共有・ブックマーク）。
 * 空値は URL に含めない（余計なクエリを付けない）。
 */
export function encodeShareParams(params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v != null) usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function decodeShareParams(search: string): Record<string, string> {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const usp = new URLSearchParams(q);
  const out: Record<string, string> = {};
  for (const [k, v] of usp.entries()) out[k] = v;
  return out;
}
