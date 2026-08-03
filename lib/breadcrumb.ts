/**
 * BreadcrumbList JSON-LD ヘルパー（QC5・auto-backlog Tier C）。
 *
 * 各記事ページで「ホーム → ツール → 記事」のパンくずを構造化データとして出力する。
 * 表示上の導線は各ページの「戻る」リンクが担うため、ここでは検索エンジン向けの
 * BreadcrumbList（schema.org）だけを提供する。記事ページの JSON-LD @graph に足すだけで、
 * 全ツール共通のパンくずを1か所で管理できる（island を作らない）。
 */
export type Crumb = { name: string; url: string };

export function breadcrumbListJsonLd(items: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
