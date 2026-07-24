/** 数値を「1,234,567円」の形式に整形（1円未満は四捨五入） */
export function yen(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  return `${n.toLocaleString("ja-JP")}円`;
}

/** 数値を「1,234,567」の形式に整形（単位なし） */
export function num(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  return n.toLocaleString("ja-JP");
}
