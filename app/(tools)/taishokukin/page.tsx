import type { Metadata } from 'next';
import Calculator from '@/components/taishokukin/Calculator';
import RelatedTools from '@/components/RelatedTools';
import ToolBreadcrumbJsonLd from '@/components/ToolBreadcrumbJsonLd';
import ToolHowToJsonLd from '@/components/ToolHowToJsonLd';
import LawBasis from '@/components/LawBasis';
import { ogImage } from "@/lib/og";

export const metadata: Metadata = {
  title: '退職金課税シミュレーター | 退職所得控除・所得税・住民税・手取り額を即時計算',
  description:
    '退職金額と勤続年数を入力するだけで、退職所得控除額・所得税・住民税・手取り額をかんたんに計算。役員退職金・短期勤続・iDeCo併用にも対応。2026年改正（DC一時金10年ルール）にも対応した最新版。',
  openGraph: {
    images: [ogImage("taishokukin")],
    title: '退職金課税シミュレーター',
    description:
      '退職金の手取り額を即時計算。「あと1年勤めると控除額がいくら増えるか」も自動で比較表示。',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: '退職金課税シミュレーター',
    description:
      '退職金の手取り額を即時計算。「あと1年勤めると控除額がいくら増えるか」も自動で比較表示。',
      images: [ogImage('taishokukin').url],
  },
  alternates: {
    canonical: '/taishokukin',
  },
};

const FAQ_ITEMS = [
  {
    q: 'このシミュレーターの計算結果は信頼できますか？',
    a: '所得税法第30条、国税庁タックスアンサー No.1420・No.2740・No.2737 に基づき、令和7年4月1日現在の法令で計算しています。ただし、あくまで参考値であり、実際の税額は退職時の他の所得や控除との通算により変動する場合があります。複雑なケースは税理士への相談をおすすめします。',
  },
  {
    q: '勤続年数の「端数月」とは何ですか？',
    a: '勤続年数に1年未満の端数（月数）があるとき、1日以上であっても1年に切り上げて計算します（所得税法施行令第69条）。例えば「19年5ヶ月」は20年として計算され、控除額が大きくなる可能性があります。',
  },
  {
    q: '役員退職金の特例とは？',
    a: '役員等として勤続5年以下で受け取る退職金（特定役員退職手当等）は、退職所得控除後の金額の1/2課税が適用されません。全額が課税退職所得金額となるため、税負担が一般の退職金よりも大きくなります。',
  },
  {
    q: '短期勤続（勤続5年以下）の場合、何が違うのですか？',
    a: '令和4年1月1日以降、勤続5年以下の一般従業員の退職金（短期退職手当等）は、退職所得控除後の金額が300万円を超える部分について1/2課税が適用されなくなりました。300万円までは従来通り1/2課税です。',
  },
  {
    q: '自己都合と会社都合で税金は変わりますか？',
    a: '退職金の所得税・住民税の計算自体は、自己都合・会社都合で変わりません。ただし、失業給付の受給開始時期や給付日数、社会保険手続きなど、その後の生活設計に大きく影響します。退職理由に応じた対応が必要です。',
  },
  {
    q: 'iDeCoや確定拠出年金との関係は？',
    a: 'iDeCo・企業型DCの一時金を受け取ってから一定期間内に退職金を受け取ると、退職所得控除が調整されます。2026年1月1日以降は「過去10年以内」（従来は5年以内）に拡大されたため、影響を受ける方が増えます。該当する方は税理士への相談をおすすめします。',
  },
  {
    q: '「退職所得の受給に関する申告書」って何ですか？',
    a: '退職時に勤務先へ提出する書類です。提出すれば退職所得控除を考慮した正しい税額が源泉徴収されますが、提出しないと退職金の20.42%が源泉徴収されてしまいます（後で確定申告すれば還付されますが、手続きが必要です）。',
  },
];


const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

const WEBAPP_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '退職金課税シミュレーター',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description:
    '退職金額と勤続年数から、退職所得控除・所得税・住民税・手取り額を計算する単機能ツール。役員退職金・短期勤続・自己都合/会社都合・2026年税制改正に対応。',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'JPY',
  },
  inLanguage: 'ja-JP',
};

export default function Home() {
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

      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">退職金課税シミュレーター</h1>
            <p className="text-sm text-gray-600 mt-1">
              退職金額と勤続年数から、退職所得控除・所得税・住民税・手取り額を即時計算
            </p>
            <p className="text-xs text-gray-500 mt-2">
              シミュレーション基準日：令和7年4月1日現在の法令（2026年税制改正対応）
            </p>
          </div>
        </header>

        {/* メイン */}
        <main className="px-4 py-8">
          <Calculator />

          {/* FAQ */}
          <section className="w-full max-w-3xl mx-auto mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">よくある質問</h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <details
                  key={i}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <summary className="cursor-pointer font-medium text-gray-900 hover:text-gray-700">
                    {item.q}
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA③: 退職代行 or 転職エージェント（フッター CTA） */}
          <section className="w-full max-w-3xl mx-auto mt-12">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
              <p className="text-xs text-slate-500 mb-2">PR</p>
              <h3 className="font-bold text-slate-900 mb-2">退職後のキャリアも、いっしょに準備</h3>
              <p className="text-sm text-slate-700 mb-4">
                退職金の試算が済んだら、次のステップへ。条件に合った転職先を、専任のキャリアアドバイザーが無料でサポートします。
              </p>
              {/* ⚠ 実URLへの差し替え＝収益化トリガー。Vercel Pro 移行のオーナー判断（STOP: 決済・課金）とセットで行う。CLAUDE.md「収益化トリガー」節を参照 */}
              <a
                href="#"
                rel="sponsored nofollow noopener noreferrer"
                target="_blank"
                className="inline-block bg-slate-800 hover:bg-slate-900 text-white font-medium px-6 py-3 rounded transition-colors"
              >
                転職エージェントに無料登録 →
              </a>
            </div>
          </section>

          <div className="w-full max-w-3xl mx-auto">
            <ToolBreadcrumbJsonLd slug="taishokukin" />
            <ToolHowToJsonLd slug="taishokukin" />
            <RelatedTools currentSlug="taishokukin" />
            <LawBasis basis="計算の根拠：所得税法第30条（退職所得控除・課税退職所得金額）／退職所得の源泉徴収税額の速算表（復興特別所得税込み）／地方税法（住民税所得割10%）。国税庁タックスアンサー No.1420・No.2732・No.2740 等。" />
          </div>
        </main>
      </div>
    </>
  );
}
