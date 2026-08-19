import type { Metadata } from 'next';
import Calculator from '@/components/ideco/Calculator';
import RelatedTools from '@/components/RelatedTools';
import ToolBreadcrumbJsonLd from '@/components/ToolBreadcrumbJsonLd';
import ToolHowToJsonLd from '@/components/ToolHowToJsonLd';
import { SITE_META } from '@/lib/ideco/site-meta';
import { ogImage } from "@/lib/og";

export const metadata: Metadata = {
  title: {
    absolute: 'iDeCo・退職金 受取順序シミュレーター｜退職所得控除の重複調整（19年/10年ルール）対応',
  },
  description:
    'iDeCoと退職金を一時金で受け取る順番・間隔で、退職所得控除の重複調整がどう変わり税金・手取りがいくらになるかを試算。2026年改正の10年ルール・19年ルールに対応。受け取り方を逆にした場合・間隔を空けた場合の手取り比較つき。',
  keywords: [
    'iDeCo 退職金 受け取り 順番 税金',
    '退職所得控除 重複 シミュレーション',
    'iDeCo 一時金 退職金 同じ年',
    '10年ルール iDeCo 退職金',
    '19年ルール 退職所得控除',
  ],
  openGraph: {
    images: [ogImage("ideco")],
    title: 'iDeCo・退職金 受取順序シミュレーター',
    description:
      'iDeCoと退職金の受取順序・間隔で、退職所得控除の重複調整込みの税額・手取りを即時計算。順序を逆／間隔を空けた場合の比較つき。2026年改正対応。',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iDeCo・退職金 受取順序シミュレーター',
    description:
      'iDeCoと退職金、いつ・どの順で受け取ると手取りが増える？退職所得控除の重複調整込みで即時計算。2026年改正対応。',
      images: [ogImage('ideco').url],
  },
  alternates: {
    canonical: '/ideco',
  },
};

const FAQ_ITEMS = [
  {
    q: '「19年ルール」と「10年ルール」は何が違いますか？',
    a: '退職金を先に受け取り、その後にiDeCo一時金を受け取る場合は「前年以前19年内」に退職金があると退職所得控除が調整されます（19年ルール）。逆にiDeCoを先に受け取り、その後に退職金を受け取る場合は「前年以前9年内」（10年ルール）で判定します。10年ルールは2026年1月1日（令和8年1月1日）以後に支払われる退職金に適用され、それ以前の旧制度（5年ルール・前年以前4年内）から延長されました。',
  },
  {
    q: 'iDeCoと退職金、どちらを先に受け取ると得ですか？',
    a: '勤続期間とiDeCo加入期間の重なり（重複年数）や、受け取る間隔によって変わります。一般に、重複が大きいほど後に受け取る一時金の控除が減るため不利になります。本ツールでは「順序を逆にした場合」「間隔を空けた場合」の手取りを自動で比較し、どの受け取り方が有利かの目安を表示します。最終判断は健康状態や運用期間も含め、税理士・FPにご相談ください。',
  },
  {
    q: '受け取る年をずらすと、本当に税金が変わるのですか？',
    a: '変わる場合があります。退職金先→iDeCo後なら20年以上、iDeCo先→退職金後なら10年以上、受取間隔を空けると重複調整がなくなり、退職所得控除をそれぞれ満額（×2）使えます。一方で、間隔が短いと重複部分の控除が減額されます。本ツールはこの境界を踏まえて自動計算します。',
  },
  {
    q: '「退職所得の受給に関する申告書」とは何ですか？',
    a: '退職金やiDeCo一時金を受け取るときに、勤務先や運営管理機関へ提出する書類です。提出すれば退職所得控除を反映した正しい税額が源泉徴収されますが、提出しないと支払額の20.42%が源泉徴収され、払い過ぎた分は確定申告で精算する必要があります。',
  },
  {
    q: 'このシミュレーターの計算は信頼できますか？',
    a: '所得税法第30条、所得税法施行令第69条・第70条・第72条、国税庁タックスアンサー No.1420・No.2732・No.2735、退職所得の源泉徴収税額の速算表に基づき、2026年1月1日（令和8年1月1日）施行の法令で計算しています（最終確認日：2026-06-21）。ただしあくまで参考値であり、年金受取との併用や短期勤続の特例など複雑なケースは扱いません。該当する場合は税理士へご相談ください。',
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

const SOFTWARE_APP_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_META.name,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description:
    'iDeCo・企業型DCの一時金と退職金を一時金で受け取る際の、受取順序・間隔による退職所得控除の重複調整を反映して、所得税・住民税・手取りを計算する単機能ツール。2026年改正（10年ルール）・19年ルール・同年合算に対応。',
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APP_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">iDeCo・退職金 受取順序シミュレーター</h1>
            <p className="text-sm text-gray-600 mt-1">
              iDeCo・企業型DCの一時金と退職金を、受け取る順序・間隔まで考慮して退職所得控除の重複調整込みで税額・手取りを即時計算
            </p>
            <p className="text-xs text-gray-500 mt-2">
              適用法令：{SITE_META.appliedLawDate}施行（2026年1月1日／10年ルール対応）・最終確認日 2026-06-21
            </p>
          </div>
        </header>

        <div className="px-4 py-8">
          {/* イントロ */}
          <section className="w-full max-w-3xl mx-auto mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                iDeCo・企業型DCの一時金と会社の退職金を<strong>どちらも一時金で受け取る</strong>と、勤続期間とiDeCo加入期間の重なりに応じて
                <strong>退職所得控除が調整（減額）</strong>されます。受け取る<strong>順序と間隔</strong>を西暦で入力するだけで、
                <strong>19年ルール・10年ルール（2026年1月1日／令和8年1月1日施行）</strong>の重複調整を反映した税額・手取りを計算し、
                「順序を逆にしたら」「間隔を空けたら」どれだけ手取りが変わるかまで比較します。
              </p>
            </div>
          </section>

          {/* 計算ツール本体 */}
          <Calculator />

          {/* FAQ */}
          <section className="w-full max-w-3xl mx-auto mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">よくある質問</h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <details key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                  <summary className="cursor-pointer font-medium text-gray-900 hover:text-gray-700">
                    {item.q}
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="w-full max-w-3xl mx-auto">
            <ToolBreadcrumbJsonLd slug="ideco" />
            <ToolHowToJsonLd slug="ideco" />
            <RelatedTools currentSlug="ideco" />
          </div>
        </div>
      </div>
    </>
  );
}
