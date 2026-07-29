import type { Metadata } from 'next';
import Link from 'next/link';
import { ARTICLES } from '@/lib/jutaku-loan/articles';

export const metadata: Metadata = {
  title: '住宅ローン控除 解説記事一覧',
  description:
    '住宅ローン控除の仕組み・控除額の計算方法・住宅性能別の借入限度額・繰上げ返済の影響などをテーマ別に解説した記事の一覧です。',
  alternates: { canonical: '/jutaku-loan/articles' },
};

export default function ArticlesIndexPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/jutaku-loan" className="text-sm text-blue-600 hover:underline">
            ← 住宅ローン控除シミュレーターに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">
            住宅ローン控除 解説記事
          </h1>
        </div>
      </header>

      <main className="px-4 py-8">
        <ul className="max-w-3xl mx-auto space-y-4">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/jutaku-loan/articles/${a.slug}`}
                className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors"
              >
                <h2 className="text-base font-bold text-gray-900">{a.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{a.lead}</p>
                <p className="text-xs text-gray-400 mt-2">最終更新：{a.updated}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
