import Link from "next/link";
import { SITE } from "@/lib/site";

/**
 * ツール共通レイアウト（/(tools)/<slug> 配下すべてに適用）。
 * 全ツールで共通のヘッダー（トップ＝ハブへ戻る導線）を提供する。
 * 個別ツールのページは本文＋末尾に <RelatedTools currentSlug=.. /> を置く。
 */
export default function ToolsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 text-sm">
        <Link href="/" className="text-black/60 hover:underline">
          ← {SITE.short}トップ（ツール一覧）
        </Link>
      </div>
      {children}
    </div>
  );
}
