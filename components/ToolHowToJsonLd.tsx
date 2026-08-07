import { SITE } from "@/lib/site";
import { TOOL_HOWTO } from "@/lib/tool-howto";

/**
 * ツールの使い方（計算手順）を schema.org HowTo として出力する（F3・2巡目）。
 * 手順データは lib/tool-howto.ts（tools-registry と同じく1か所編集で追従）。
 * 該当 slug の手順が無ければ何も出力しない（安全側）。
 */
export default function ToolHowToJsonLd({ slug }: { slug: string }) {
  const howto = TOOL_HOWTO[slug];
  if (!howto) return null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: howto.name,
    inLanguage: "ja",
    step: howto.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      url: `${SITE.url}/${slug}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
