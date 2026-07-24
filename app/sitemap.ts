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

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE.lawCheckedAt);

  const toolEntries: MetadataRoute.Sitemap = liveTools().map((t) => ({
    url: `${SITE.url}/${t.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // 各ツールの記事（トピッククラスタ）。移行/新規で記事を持つツールを増やしたら
  // ここに1ブロック足す（当面は taishokukin のみ）。
  const taishokukinArticles: MetadataRoute.Sitemap = [
    {
      url: `${SITE.url}/taishokukin/articles`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...TAISHOKUKIN_ARTICLES.map((a) => ({
      url: `${SITE.url}/taishokukin/articles/${a.slug}`,
      lastModified: new Date(a.updated),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];

  return [
    {
      url: SITE.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...toolEntries,
    ...taishokukinArticles,
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
