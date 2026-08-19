import type { Metadata } from "next";
import Link from "next/link";
import Calculator from "@/components/tedori/Calculator";
import RelatedTools from "@/components/RelatedTools";
import ToolBreadcrumbJsonLd from "@/components/ToolBreadcrumbJsonLd";
import ToolHowToJsonLd from "@/components/ToolHowToJsonLd";
import { getAllArticles } from "@/lib/tedori/articles";
import { FAQ_ITEMS } from "@/lib/tedori/faq";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, LAW_CHECKED_AT } from "@/lib/tedori/site";
import { ogImage } from "@/lib/og";

export const metadata: Metadata = {
  alternates: { canonical: "/tedori" },
  openGraph: {
    images: [ogImage("tedori")],
  },
  twitter: {
    card: "summary_large_image",
    images: [ogImage("tedori").url],
  },
};

export default function HomePage() {
  const articles = getAllArticles();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        description: SITE_DESCRIPTION,
        offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
        inLanguage: "ja",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ToolBreadcrumbJsonLd slug="tedori" />
      <ToolHowToJsonLd slug="tedori" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          年収の手取り計算シミュレーター
        </h1>
        <p className="mt-3 text-slate-600">
          年収（額面）を入力するだけで、そこから引かれる
          <strong>社会保険料（健康保険・厚生年金・雇用保険・子ども・子育て支援金・介護保険）</strong>と
          <strong>所得税・住民税</strong>を計算し、
          <strong>手取り額（年額・月額）と手取り率</strong>の目安を表示します。令和7年改正後の給与所得控除・基礎控除に対応しています。
        </p>
      </div>

      <Calculator />

      <section className="mt-14" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xl font-bold text-slate-900">
          手取りはどうやって計算する？
        </h2>
        <div className="prose-jp mt-4 space-y-4 text-slate-700">
          <p>
            額面の年収から手取りになるまでには、大きく次の2種類が差し引かれます。会社員の手取りは、おおむね年収の75〜85%が目安です。
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>社会保険料</strong>：健康保険（4.95%）・厚生年金（9.15%）・雇用保険（0.5%）・子ども・子育て支援金（0.115%）。40〜64歳は介護保険（0.81%）も加算。合計で年収の約14〜15%（令和8年度・協会けんぽ全国平均）。
            </li>
            <li>
              <strong>税金</strong>：給与所得控除・基礎控除・社会保険料控除を差し引いた課税所得に、所得税（5〜45%＋復興特別所得税2.1%）と住民税（約10%＋均等割）がかかります。
            </li>
          </ol>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="articles-heading">
        <h2 id="articles-heading" className="text-xl font-bold text-slate-900">
          くわしく知る
        </h2>
        <ul className="mt-4 space-y-3">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/tedori/articles/${article.slug}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand hover:bg-brand/5"
              >
                <span className="block font-semibold text-brand-dark">{article.title}</span>
                <span className="mt-1 block text-sm text-slate-600">{article.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-xl font-bold text-slate-900">
          よくある質問
        </h2>
        <dl className="mt-4 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="font-semibold text-slate-800">{item.question}</dt>
              <dd className="mt-2 text-sm text-slate-600">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <RelatedTools currentSlug="tedori" />

      <p className="mt-10 text-xs text-slate-400">
        計算ロジックの法令・料率確認日：{LAW_CHECKED_AT}。税制改正・料率改定により内容が変わる場合があります。
      </p>
    </>
  );
}
