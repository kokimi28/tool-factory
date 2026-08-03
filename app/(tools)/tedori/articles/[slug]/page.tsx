import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle } from "@/lib/tedori/articles";
import { SITE_NAME, SITE_URL } from "@/lib/tedori/site";
import { SITE } from "@/lib/site";
import { breadcrumbListJsonLd } from "@/lib/breadcrumb";
import RelatedTools from "@/components/RelatedTools";

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

// 未知の slug は 404（静的生成した記事のみ配信）
export const dynamicParams = false;

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
    alternates: { canonical: `/tedori/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      url: `${SITE_URL}/articles/${article.slug}`,
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
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.description,
        datePublished: article.updatedAt,
        dateModified: article.updatedAt,
        inLanguage: "ja",
        mainEntityOfPage: `${SITE_URL}/articles/${article.slug}`,
        publisher: { "@type": "Organization", name: SITE_NAME },
      },
      breadcrumbListJsonLd([
        { name: "ホーム", url: SITE.url },
        { name: SITE_NAME, url: SITE_URL },
        { name: article.title, url: `${SITE_URL}/articles/${article.slug}` },
      ]),
    ],
  };

  return (
    <article className="prose-jp max-w-none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-4 text-sm text-slate-500" aria-label="パンくず">
        <Link href="/tedori" className="hover:text-brand-dark">
          ホーム
        </Link>
        <span className="mx-1">/</span>
        <span>{article.title}</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">{article.title}</h1>
      <p className="mt-2 text-xs text-slate-400">最終更新：{article.updatedAt}</p>

      <div className="mt-6 space-y-6 text-slate-700">
        {article.sections.map((section, i) => (
          <section key={i}>
            {section.heading ? (
              <h2 className="text-xl font-bold text-slate-900">{section.heading}</h2>
            ) : null}
            <div className={section.heading ? "mt-3 space-y-3" : "space-y-3"}>
              {section.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-brand/20 bg-brand/5 p-5">
        <p className="text-sm text-slate-700">
          退職金にかかる税金の概算は、
          <Link href="/tedori" className="font-semibold text-brand-dark underline underline-offset-2">
            退職金の税金計算シミュレーター
          </Link>
          で確認できます。
        </p>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        本記事は情報提供を目的としたもので、税務上の助言ではありません。金額は参考値です。
      </p>

      <RelatedTools currentSlug="tedori" />
    </article>
  );
}
