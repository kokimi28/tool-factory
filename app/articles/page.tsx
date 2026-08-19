import type { Metadata } from "next";
import Link from "next/link";
import LinkPending from "@/components/LinkPending";
import { SITE } from "@/lib/site";
import { allArticles } from "@/lib/all-articles";
import { liveTools } from "@/lib/tools-registry";

export const metadata: Metadata = {
  title: "解説記事一覧（全ツール横断）",
  description:
    "退職金・iDeCo・ふるさと納税・住宅ローン控除・年収の壁・年金の繰上げ繰下げ・年収の手取りなど、各税金計算ツールの解説記事を1か所にまとめた記事ハブです。",
  alternates: { canonical: "/articles" },
};

// 集約ページ（CollectionPage）を ItemList で構造化。各ツール記事への内部リンクを
// 検索エンジンにも1か所で提示する（島を作らない・網羅監査の到達点を可視化）。
function collectionJsonLd(count: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "解説記事一覧（全ツール横断）",
    url: `${SITE.url}/articles`,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: count,
    },
  };
}

export default function AllArticlesPage() {
  const articles = allArticles();
  // ツール単位でまとめる（レジストリの並び順を尊重）。
  const groups = liveTools()
    .map((tool) => ({
      tool,
      items: articles.filter((a) => a.toolSlug === tool.slug),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionJsonLd(articles.length)),
        }}
      />

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← ツール一覧に戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">
            解説記事一覧
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            各税金計算ツールの解説記事（全 {articles.length} 本）をツール別にまとめています。
            気になるテーマから読み、そのままツールで試算できます。
          </p>
        </div>
      </header>

      <div className="px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-10">
          {groups.map(({ tool, items }) => (
            <section key={tool.slug} aria-labelledby={`tool-${tool.slug}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2
                  id={`tool-${tool.slug}`}
                  className="text-lg font-bold text-gray-900"
                >
                  {tool.name}
                </h2>
                <Link
                  href={`/${tool.slug}`}
                  className="shrink-0 text-sm text-blue-600 hover:underline"
                >
                  ツールを開く →
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {items.map((a) => (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors"
                    >
                      <h3 className="text-base font-bold text-gray-900">
                        {a.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {a.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        最終更新：{a.updated}
                      </p>
                      <LinkPending />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
