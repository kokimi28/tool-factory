"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * エラーバウンダリ（F12・2巡目）。ルートセグメントで想定外の例外が起きたとき、
 * 白画面にせず再試行とツール一覧への導線を出す。Next App Router の規約コンポーネント。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 予期しないエラーは開発時に確認できるよう console に出す（外部送信はしない）。
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          エラーが発生しました
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          一時的な問題の可能性があります。再試行するか、ツール一覧からやり直してください。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            再試行
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400"
          >
            ツール一覧へ
          </Link>
        </div>
      </div>
    </div>
  );
}
