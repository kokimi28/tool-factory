import type { Metadata } from 'next';
import Link from 'next/link';
import LinkPending from '@/components/LinkPending';
import { ARTICLES } from '@/lib/furusato/articles';

export const metadata: Metadata = {
  title: 'ふるさと納税 解説記事一覧',
  description:
    'ふるさと納税の限度額の仕組み・計算式・年収別の目安・控除の内訳などをテーマ別に解説した記事の一覧です。',
  alternates: { canonical: '/furusato/articles' },
};

export default function ArticlesIndexPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/furusato" className="text-sm text-blue-600 hover:underline">
            ← ふるさと納税 限度額シミュレーターに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">
            ふるさと納税 解説記事
          </h1>
        </div>
      </header>

      <div className="px-4 py-8">
        <ul className="max-w-3xl mx-auto space-y-4">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/furusato/articles/${a.slug}`}
                className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors"
              >
                <h2 className="text-base font-bold text-gray-900">{a.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{a.lead}</p>
                <p className="text-xs text-gray-500 mt-2">最終更新：{a.updated}</p>
                      <LinkPending />
                    </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
