import { SITE } from "@/lib/site";
import { getTool } from "@/lib/tools-registry";
import { breadcrumbListJsonLd } from "@/lib/breadcrumb";

/**
 * ツールのハブページ用パンくず構造化データ（F3・2巡目）。
 * 「ホーム → <ツール名>」の BreadcrumbList を単独 script で出力する。
 * 記事ページは QC5 で対応済み。ツール名は tools-registry を正として引く（島を作らない）。
 */
export default function ToolBreadcrumbJsonLd({ slug }: { slug: string }) {
  const name = getTool(slug)?.name ?? slug;
  const jsonLd = {
    "@context": "https://schema.org",
    ...breadcrumbListJsonLd([
      { name: "ホーム", url: SITE.url },
      { name, url: `${SITE.url}/${slug}` },
    ]),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
