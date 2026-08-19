"use client";

import { useLinkStatus } from "next/link";

/**
 * リンクを押してから次のページが描画されるまでの待ち表示（auto-backlog F12）。
 *
 * **なぜ loading.tsx ではないか**: 本サイトは全ページが静的生成で、遷移時に
 * サーバ側で待つものが無い。実測でも `app/loading.tsx` と
 * `app/(tools)/loading.tsx`、さらに変わるセグメント直下の loading.tsx を置いて
 * RSC ペイロードの取得を2.5秒遅らせたが、fallback は一度も描画されなかった
 * （Next は取得が終わるまで現在のページを表示したままにする）。
 * 置いても実行されないファイルになるので採用していない。
 *
 * 代わりに Next 15.3+ の `useLinkStatus` を使う。これは「静的ルートで
 * loading.tsx が出ないが押した反応は返したい」ためのフックで、
 * `<Link>` の**子**として描画されている間だけ pending を返す。
 */
export default function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className={`inline-flex items-center ${className}`}>
      <span className="sr-only">読み込み中</span>
      <span
        aria-hidden="true"
        className="ml-2 inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-600 motion-safe:animate-spin"
      />
    </span>
  );
}
