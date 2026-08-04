/**
 * 内部リンクの生成ヘルパー（QC13・slug 参照の共通化）。
 *
 * 記事本文やハブから各ツール・記事へのリンクは、これまで各ページに文字列で
 * ハードコードされていた（`href="/tedori"` 等）。slug 変更やタイポで内部リンクが
 * 静かに壊れるのを防ぐため、slug からの href 生成をここに一本化する。
 * tools-registry を正として「有効な内部リンク先」を判定できるようにもする
 * （internal-links.test が全ページのハードコード内部リンクを本モジュールで検査する）。
 */
import { getTool } from "./tools-registry";

/** ツールのハブページ href（例: /tedori）。 */
export function toolHref(slug: string): string {
  return `/${slug}`;
}

/** ツール個別の記事一覧 href（例: /tedori/articles）。 */
export function toolArticlesHref(slug: string): string {
  return `/${slug}/articles`;
}

/** 記事本文 href（例: /tedori/articles/foo）。 */
export function articleHref(toolSlug: string, articleSlug: string): string {
  return `/${toolSlug}/articles/${articleSlug}`;
}

/** 全ツール横断の記事集約ハブ（QC4 で新設）。 */
export const ARTICLES_INDEX_HREF = "/articles";

/** ツール slug 以外で内部リンク先として許可される静的ルートの先頭セグメント。 */
export const STATIC_ROUTE_SEGMENTS = [
  "articles",
  "about",
  "privacy",
  "disclosure",
] as const;

/**
 * 内部パスの先頭セグメントが有効か（公開中ツール slug or 既知の静的ルート）。
 * ルート "/"（先頭セグメント空）も内部リンクとして許可する。
 */
export function isKnownInternalRoot(segment: string): boolean {
  if (segment === "") return true;
  if ((STATIC_ROUTE_SEGMENTS as readonly string[]).includes(segment)) return true;
  return getTool(segment)?.status === "live";
}
