import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTICLES, getArticle } from '@/lib/furusato/articles';
import { SITE_META } from '@/lib/furusato/site-meta';
import { SITE } from '@/lib/site';
import { breadcrumbListJsonLd } from '@/lib/breadcrumb';
import RelatedTools from '@/components/RelatedTools';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/furusato/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      url: `${SITE_META.url}/articles/${article.slug}`,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: article.title,
        description: article.description,
        datePublished: article.published,
        dateModified: article.updated,
        author: { '@type': 'Organization', name: SITE_META.name },
        publisher: { '@type': 'Organization', name: SITE_META.name },
        mainEntityOfPage: `${SITE_META.url}/articles/${article.slug}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: article.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      breadcrumbListJsonLd([
        { name: 'ホーム', url: SITE.url },
        { name: SITE_META.name, url: SITE_META.url },
        { name: article.title, url: `${SITE_META.url}/articles/${article.slug}` },
      ]),
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/furusato" className="text-sm text-blue-600 hover:underline">
            ← ふるさと納税 限度額シミュレーターに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">{article.title}</h1>
          <p className="text-xs text-gray-500 mt-2">
            公開日：{article.published} ／ 最終更新：{article.updated}（
            {SITE_META.appliedLawDate}の法令に基づく）
          </p>
        </div>
      </header>

      <div className="px-4 py-8">
        <article className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg p-6 space-y-8 text-sm text-gray-800 leading-relaxed">
          <p className="text-base text-gray-900">{article.lead}</p>

          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                {section.heading}
              </h2>
              {section.paragraphs.map((p, i) => (
                <p key={i} className={i > 0 ? 'mt-3' : undefined}>
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              よくある質問（FAQ）
            </h2>
            <dl className="space-y-4">
              {article.faqs.map((f) => (
                <div key={f.question}>
                  <dt className="font-bold text-gray-900">Q. {f.question}</dt>
                  <dd className="mt-1">A. {f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-2">
            <p className="text-gray-800">
              あなたの限度額は、
              <Link href="/furusato" className="text-blue-600 hover:underline font-medium">
                ふるさと納税 限度額シミュレーター
              </Link>
              に年収または課税所得を入力すればすぐに確認できます。
            </p>
            <p className="text-gray-800">
              関連ツール：
              <Link href="/tedori" className="text-blue-600 hover:underline">
                年収の手取り計算
              </Link>
              ／
              <Link href="/nenshu-kabe" className="text-blue-600 hover:underline">
                年収の壁シミュレーター
              </Link>
            </p>
          </section>

          <p className="text-xs text-gray-500 border-t border-gray-200 pt-4">
            ※本記事は情報提供を目的とした一般的な解説であり、税務・法律・金融の助言ではありません。計算結果はあくまで概算・参考値です。個別の事情については税理士・FP 等の専門家にご相談ください。
          </p>
        </article>
        <div className="max-w-3xl mx-auto">
          <RelatedTools currentSlug="furusato" />
        </div>
      </div>
    </div>
  );
}
