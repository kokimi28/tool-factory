import type { Metadata } from "next";
import Calculator from "@/components/furusato/Calculator";
import RelatedTools from "@/components/RelatedTools";
import ToolBreadcrumbJsonLd from "@/components/ToolBreadcrumbJsonLd";
import ToolHowToJsonLd from "@/components/ToolHowToJsonLd";

export const metadata: Metadata = {
  title: "ふるさと納税 限度額シミュレーター｜自己負担2,000円で済む寄付上限を計算",
  description:
    "年収や課税所得から、自己負担2,000円で済むふるさと納税の控除上限額の目安を計算。総務省の式（住民税所得割×20%÷(90%−所得税率×1.021)+2,000）に基づく無料シミュレーター。配偶者・扶養の有無にも対応。",
  alternates: { canonical: "/furusato" },
  openGraph: {
    title: "ふるさと納税 限度額シミュレーター",
    description:
      "年収・家族構成から、自己負担2,000円で済むふるさと納税の上限額の目安を即計算。",
    type: "website",
    locale: "ja_JP",
  },
};

const FAQ_ITEMS = [
  {
    q: "ふるさと納税の「限度額」とは何ですか？",
    a: "寄付額のうち自己負担が2,000円で済む（それを超える分が所得税・住民税から全額控除される）年間の寄付額の上限です。上限を超えて寄付した分は控除されず、自己負担になります。",
  },
  {
    q: "限度額はどうやって決まりますか？",
    a: "主に住民税の所得割額（課税総所得金額×10%）と所得税の限界税率で決まります。総務省の式では『住民税所得割額×20%÷(90%−所得税率×1.021)+2,000円』で計算します。年収が同じでも、家族構成や各種控除で課税所得が変わると限度額も変わります。",
  },
  {
    q: "年収からの概算はどのくらい正確ですか？",
    a: "本サイトの年収概算は、社会保険料を年収の約14.75%とみなし、基礎控除・配偶者控除・扶養控除のみを考慮した簡易計算です。医療費控除・住宅ローン控除・iDeCo（小規模企業共済等掛金控除）などがあると課税所得が下がり、限度額も下がります。正確に出すには住民税決定通知書の課税総所得金額を「課税所得から正確に」タブに入力してください。",
  },
  {
    q: "住宅ローン控除やiDeCoがあると限度額は変わりますか？",
    a: "変わります。iDeCoの掛金は課税所得を下げるため限度額も下がります。住宅ローン控除は所得税の控除ですが、控除しきれない分が住民税に回るケースなどで影響することがあります。該当する場合は課税所得を直接入力するか、自治体・税理士にご確認ください。",
  },
  {
    q: "ワンストップ特例と確定申告で、控除の上限額は変わりますか？",
    a: "自己負担2,000円で済む寄付の上限額そのものは、ワンストップ特例でも確定申告でも基本的に同じです。違うのは控除の内訳で、ワンストップ特例は全額が翌年度の住民税から控除され、確定申告では所得税の還付＋住民税の控除に分かれます。ワンストップ特例は寄付先が年間5自治体以内で、医療費控除などで確定申告をしない人が対象です。",
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
  name: "ふるさと納税 限度額シミュレーター",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "年収や課税所得から、自己負担2,000円で済むふるさと納税の控除上限額の目安を計算する単機能ツール。",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  inLanguage: "ja-JP",
};

export default function FurusatoPage() {
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
          ふるさと納税 限度額シミュレーター
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          年収または課税所得から、自己負担2,000円で済むふるさと納税の控除上限額の目安を計算します（総務省の式に基づく概算）。
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
        <ToolBreadcrumbJsonLd slug="furusato" />
        <ToolHowToJsonLd slug="furusato" />
        <RelatedTools currentSlug="furusato" />
      </div>

      <p className="mt-10 text-xs text-gray-400 max-w-2xl mx-auto">
        計算式の根拠：総務省ふるさと納税ポータルサイト（控除額の計算）／地方税法第37条の2・第314条の7。最終確認日 2026-07-24。本サイトの計算結果は概算・参考値です。
      </p>
    </>
  );
}
