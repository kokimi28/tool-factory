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

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE.lawCheckedAt);

  const toolEntries: MetadataRoute.Sitemap = liveTools().map((t) => ({
    url: `${SITE.url}/${t.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...toolEntries,
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
