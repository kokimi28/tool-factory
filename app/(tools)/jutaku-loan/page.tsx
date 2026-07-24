import type { Metadata } from "next";
import Calculator from "@/components/jutaku-loan/Calculator";
import RelatedTools from "@/components/RelatedTools";

export const metadata: Metadata = {
  title: "住宅ローン控除シミュレーター｜年末残高×0.7%の控除額を年別に計算",
  description:
    "借入額・金利・返済期間・住宅の環境性能から、住宅ローン控除（住宅借入金等特別控除）の各年・総額の控除見込みを計算。控除率0.7%・新築13年/中古10年・省エネ住宅の借入限度額に対応した無料シミュレーター（令和6年入居基準）。",
  alternates: { canonical: "/jutaku-loan" },
  openGraph: {
    title: "住宅ローン控除シミュレーター",
    description:
      "借入額・住宅性能から、住宅ローン控除の年別・総額の控除見込みを即計算（令和6年入居基準）。",
    type: "website",
    locale: "ja_JP",
  },
};

const FAQ_ITEMS = [
  {
    q: "住宅ローン控除の控除額はどう決まりますか？",
    a: "各年の控除額は「その年の年末ローン残高（借入限度額が上限）× 0.7%」です。控除期間は新築・買取再販が13年、既存（中古）住宅が10年です（令和4年改正後）。借入限度額は住宅の環境性能で変わります。",
  },
  {
    q: "借入限度額は住宅によってどう違いますか？",
    a: "令和6年（2024年）入居の新築では、認定長期優良・低炭素住宅4,500万円、ZEH水準3,500万円、省エネ基準適合3,000万円。子育て世帯・若者夫婦世帯はそれぞれ上乗せ（5,000万/4,500万/4,000万円）。中古は認定住宅等3,000万円・その他2,000万円です。",
  },
  {
    q: "計算した控除額は必ず全額戻ってきますか？",
    a: "いいえ。控除は所得税から差し引かれ、控除しきれない分は住民税から控除されますが、住民税からの控除には上限（課税総所得金額×5%・最大97,500円）があります。そのため『残高×0.7%』を使い切れないこともあります。本ツールはこの上限を考慮していない概算です。",
  },
  {
    q: "繰り上げ返済すると控除はどうなりますか？",
    a: "繰り上げ返済で年末残高が減ると、その年以降の控除額（残高×0.7%）も減ります。控除メリットと利息軽減を比べて判断が必要です。本ツールは繰り上げ返済のない前提の概算です。",
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
  name: "住宅ローン控除シミュレーター",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "借入額・住宅性能から住宅ローン控除の各年・総額の控除見込みを計算する単機能ツール。",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  inLanguage: "ja-JP",
};

export default function JutakuLoanPage() {
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
          住宅ローン控除シミュレーター
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          借入額・金利・返済期間・住宅の環境性能から、住宅ローン控除（住宅借入金等特別控除）の各年・総額の控除見込みを計算します（令和6年入居基準・概算）。
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
        <RelatedTools currentSlug="jutaku-loan" />
      </div>

      <p className="mt-10 text-xs text-gray-400 max-w-2xl mx-auto">
        計算の根拠：国税庁タックスアンサー No.1211-1（住宅借入金等特別控除・令和4年以降入居）。最終確認日 2026-07-24。控除率0.7%・新築13年/中古10年。本サイトの計算結果は概算・参考値です。
      </p>
    </>
  );
}
