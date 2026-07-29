/**
 * sitemap.xml（全ツール・全記事を1本に集約）。
 * tools-registry の公開中ツールを起点に生成するため、ツールを1つ公開すれば
 * このサイトマップに自動で載る（個別リポの sitemap を束ねる作業は不要）。
 *
 * C1 以降、各ツールの記事（/(tools)/<slug>/articles/…）もツール側から
 * 取り込んで列挙する（移行時に本ファイルへ結線）。
 */
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { liveTools } from "@/lib/tools-registry";
import { ARTICLES as TAISHOKUKIN_ARTICLES } from "@/lib/taishokukin/articles";
import { ARTICLES as IDECO_ARTICLES } from "@/lib/ideco/articles";
import { getAllArticles as tedoriArticles } from "@/lib/tedori/articles";
import { ARTICLES as FURUSATO_ARTICLES } from "@/lib/furusato/articles";
import { ARTICLES as JUTAKU_LOAN_ARTICLES } from "@/lib/jutaku-loan/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE.lawCheckedAt);

  const toolEntries: MetadataRoute.Sitemap = liveTools().map((t) => ({
    url: `${SITE.url}/${t.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // 各ツールの記事（トピッククラスタ）を1本に集約。記事を持つツールを移行/新規で
  // 増やしたら、下の articleSets に1行足すだけ（一覧＋各記事が自動で載る）。
  const articleEntries = (
    slug: string,
    articles: ReadonlyArray<{ slug: string; updated: string }>,
    includeIndex: boolean,
  ): MetadataRoute.Sitemap => [
    // 記事一覧ページを持つツールだけ index URL を載せる（tedori は一覧ルート無し）。
    ...(includeIndex
      ? [
          {
            url: `${SITE.url}/${slug}/articles`,
            lastModified,
            changeFrequency: "monthly" as const,
            priority: 0.6,
          },
        ]
      : []),
    ...articles.map((a) => ({
      url: `${SITE.url}/${slug}/articles/${a.slug}`,
      lastModified: new Date(a.updated),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];

  const articleSets: MetadataRoute.Sitemap = [
    ...articleEntries("taishokukin", TAISHOKUKIN_ARTICLES, true),
    ...articleEntries("ideco", IDECO_ARTICLES, true),
    ...articleEntries("furusato", FURUSATO_ARTICLES, true),
    ...articleEntries("jutaku-loan", JUTAKU_LOAN_ARTICLES, true),
    // tedori の Article は updatedAt を使う／一覧ルートは持たない
    ...articleEntries(
      "tedori",
      tedoriArticles().map((a) => ({ slug: a.slug, updated: a.updatedAt })),
      false,
    ),
  ];

  return [
    {
      url: SITE.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...toolEntries,
    ...articleSets,
    {
      url: `${SITE.url}/about`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE.url}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE.url}/disclosure`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
