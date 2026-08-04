import type { Metadata } from "next";
import Calculator from "@/components/nenkin-kuriage/Calculator";
import RelatedTools from "@/components/RelatedTools";

export const metadata: Metadata = {
  title: "年金 繰上げ・繰下げ 損益分岐シミュレーター｜何歳から受給すると得？",
  description:
    "年金の受給開始を早める繰上げ（0.4%/月減）・遅らせる繰下げ（0.7%/月増）で、月額と損益分岐年齢（累計が65歳受給に追いつく年齢）を計算。60〜75歳の受給率と損得を比較できる無料シミュレーター。",
  alternates: { canonical: "/nenkin-kuriage" },
  openGraph: {
    title: "年金 繰上げ・繰下げ 損益分岐シミュレーター",
    description:
      "受給開始年齢ごとの月額と、65歳受給との損益分岐年齢を即計算。",
    type: "website",
    locale: "ja_JP",
  },
};

const FAQ_ITEMS = [
  {
    q: "年金の繰上げ・繰下げで受給額はどう変わりますか？",
    a: "受給開始を65歳より早める「繰上げ」は1か月あたり0.4%の減額（60歳まで早めると最大24%減）、遅らせる「繰下げ」は1か月あたり0.7%の増額（75歳まで遅らせると最大84%増）です（昭和37年4月2日以降生まれ）。一度決めた率は一生変わりません。",
  },
  {
    q: "損益分岐年齢とは何ですか？",
    a: "受給開始を変えたときの累計受給額が、65歳から受け取った場合の累計に追いつく（追い越す）年齢です。たとえば70歳から繰下げると月額は42%増えますが、累計で65歳受給を上回るのは約81歳11か月以降です。それより長生きするほど繰下げが有利になります。",
  },
  {
    q: "繰下げは何歳まで待つのが得ですか？",
    a: "何歳まで生きるか（健康状態・家系）と、その間の生活費をどう賄うかで変わります。損益分岐年齢を一つの目安に、長生きに備えるなら繰下げ、早く確実に受け取りたい・当面の生活費が必要なら繰上げや65歳受給、と考えるとよいでしょう。",
  },
  {
    q: "この計算に含まれていないものはありますか？",
    a: "加給年金・振替加算・在職老齢年金による支給停止、受給額にかかる税金・社会保険料は含めていません。繰下げ待機中に亡くなった場合の未支給年金の扱いなども別途考慮が必要です。正確な見込みは日本年金機構・年金事務所でご確認ください。",
  },
  {
    q: "一度請求した繰上げ・繰下げは取り消せますか？",
    a: "適用された減額率・増額率は生涯変わらず、繰上げ請求は原則として取り消せません。繰上げには、障害基礎年金を受けられなくなる・遺族年金と併給できない期間があるなどのデメリットもあるため、慎重に判断してください。迷う場合は年金事務所で試算を受けるのが確実です。",
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
  name: "年金 繰上げ・繰下げ 損益分岐シミュレーター",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "年金の受給開始年齢ごとの月額と、65歳受給との損益分岐年齢を計算する単機能ツール。",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  inLanguage: "ja-JP",
};

export default function NenkinKuriagePage() {
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
          年金 繰上げ・繰下げ 損益分岐シミュレーター
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          年金の受給開始年齢（60〜75歳）を変えると月額と累計がどう変わり、65歳受給との損益分岐年齢が何歳になるかを計算します（概算）。
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
        <RelatedTools currentSlug="nenkin-kuriage" />
      </div>

      <p className="mt-10 text-xs text-gray-400 max-w-2xl mx-auto">
        計算の根拠：日本年金機構「年金の繰上げ受給／繰下げ受給」（繰上げ0.4%/月・繰下げ0.7%/月、昭和37年4月2日以降生まれ）。損益分岐年齢は受給率のみで決まり年金額に依りません。本サイトの計算結果は概算・参考値です。最終確認日 2026-07-24。
      </p>
    </>
  );
}
