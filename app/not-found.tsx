import type { Metadata } from "next";
import Link from "next/link";

/**
 * 404 ページ（F12・2巡目）。存在しないルートに来たとき、行き止まりにせず
 * ツール一覧・記事ハブへ導線を出す。noindex で検索インデックスから除外。
 */
export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm font-semibold text-blue-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          ページが見つかりません
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          お探しのページは移動または削除された可能性があります。以下からお探しください。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            ツール一覧へ
          </Link>
          <Link
            href="/articles"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400"
          >
            解説記事一覧へ
          </Link>
        </div>
      </div>
    </div>
  );
}
