import type { Metadata } from "next";
import Calculator from "@/components/nenshu-kabe/Calculator";
import RelatedTools from "@/components/RelatedTools";
import ToolBreadcrumbJsonLd from "@/components/ToolBreadcrumbJsonLd";
import ToolHowToJsonLd from "@/components/ToolHowToJsonLd";
import { ogImage } from "@/lib/og";

export const metadata: Metadata = {
  title: "年収の壁 手取り逆転シミュレーター｜106万・130万の壁で手取りはいくら下がる？",
  description:
    "パート・アルバイトの年収が106万円・130万円の壁を超えると、社会保険料で手取りが逆転（働き損）します。壁の前後の手取りと、手取りが元に戻る回復年収を計算する無料シミュレーター。",
  alternates: { canonical: "/nenshu-kabe" },
  openGraph: {
    images: [ogImage("nenshu-kabe")],
    title: "年収の壁 手取り逆転シミュレーター",
    description:
      "106万・130万の壁で手取りがいくら下がり、いくら稼げば元に戻るかを即計算。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    images: [ogImage("nenshu-kabe").url],
  },
};

const FAQ_ITEMS = [
  {
    q: "「年収の壁」で手取りが逆転するのはなぜですか？",
    a: "106万円または130万円の壁を超えると、本人が社会保険（健康保険・厚生年金）に加入し保険料の負担が発生します。年収が少し増えた以上に保険料が引かれるため、壁を超えた直後は手取りが下がる（逆転する）ことがあります。",
  },
  {
    q: "106万円と130万円の壁の違いは何ですか？",
    a: "勤務先が特定適用事業所などの要件（従業員数・週の労働時間・月額賃金など）を満たす場合は年収106万円で社会保険に加入します。当てはまらない場合でも、年収130万円を超えると配偶者の扶養から外れ、自分で社会保険に加入します。どちらが適用されるかは勤務先の状況で決まります。",
  },
  {
    q: "壁を超えて働くと損なのですか？",
    a: "手取りが元に戻るまでの一定の年収帯（本ツールの『回復年収』まで）は、働いても手取りが増えにくくなります。ただしそれを超えて働けば手取りは増え、厚生年金で将来の年金が増える・傷病手当金などの保障が手厚くなるメリットもあります。短期の手取りだけでなく総合的に判断するのがおすすめです。",
  },
  {
    q: "配偶者控除・配偶者特別控除は考慮していますか？",
    a: "本ツールは『本人』の手取りを計算します。配偶者控除・配偶者特別控除は世帯（配偶者側）の税に関わるもので、150万円・201万円の壁として別に影響します。世帯全体での最適化は税理士・FP にご相談ください。",
  },
  {
    q: "103万円の壁と、106万円・130万円の壁はどう違いますか？",
    a: "103万円の壁は本人に所得税がかかり始めるラインで、超えても増えるのは税額のわずかな分だけです。一方106万円・130万円の壁は社会保険料の発生ラインで、超えると保険料の負担が一度に生じるため手取りへの影響がはるかに大きく、逆転が起きるのはこちらです。なお令和7年分からは基礎控除等の見直しで所得税がかかり始める年収の目安が上がっており、本ツールも改正後の控除で計算しています。",
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

const WEBAPP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "年収の壁 手取り逆転シミュレーター",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "年収の壁（106万・130万）で手取りがどう逆転し、いくら稼げば元に戻るかを計算する単機能ツール。",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  inLanguage: "ja-JP",
};

export default function NenshuKabePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBAPP_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          年収の壁 手取り逆転シミュレーター
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          パート・アルバイトの年収が106万円・130万円の壁を超えると、社会保険料で手取りがどれだけ下がり、いくら稼げば元に戻るかを計算します（本人の手取り・概算）。
        </p>
      </header>

      <Calculator />

      <section className="mt-12 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">よくある質問</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="rounded-lg border border-gray-200 bg-white p-4">
              <summary className="cursor-pointer font-medium text-gray-900 hover:text-gray-700">
                {item.q}
              </summary>
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="max-w-2xl mx-auto">
        <ToolBreadcrumbJsonLd slug="nenshu-kabe" />
        <ToolHowToJsonLd slug="nenshu-kabe" />
        <RelatedTools currentSlug="nenshu-kabe" />
      </div>

      <p className="mt-10 text-xs text-gray-400 max-w-2xl mx-auto">
        手取りの計算は当サイトの「年収の手取り計算」と同一仕様（健康保険・厚生年金・雇用保険・子ども・子育て支援金＋所得税・住民税、令和7年改正対応）。106万/130万の壁の適用は勤務先の要件で決まります。本サイトの計算結果は概算・参考値です。最終確認日 2026-08-16。
      </p>
    </>
  );
}
