import Link from "next/link";
import { SITE } from "@/lib/site";
import { liveTools } from "@/lib/tools-registry";

/**
 * 全ページ共通フッター。公開中ツールへのリンクを自動列挙する
 * （tools-registry を1か所編集すれば全ツールのフッターに反映＝島を作らない）。
 */
export default function SiteFooter() {
  const tools = liveTools();
  return (
    <footer className="border-t border-black/10 mt-16 py-8 text-sm text-black/60">
      <div className="mx-auto max-w-3xl px-4 space-y-4">
        {tools.length > 0 && (
          <nav aria-label="ツール一覧" className="flex flex-wrap gap-x-4 gap-y-2">
            {tools.map((t) => (
              <Link key={t.slug} href={`/${t.slug}`} className="hover:underline">
                {t.short}
              </Link>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/" className="hover:underline">
            ツール一覧
          </Link>
          <Link href="/articles" className="hover:underline">
            解説記事一覧
          </Link>
          <Link href="/about" className="hover:underline">
            このサイトについて
          </Link>
          <Link href="/privacy" className="hover:underline">
            プライバシーポリシー
          </Link>
          <Link href="/disclosure" className="hover:underline">
            免責事項
          </Link>
        </div>
        <p className="text-xs text-black/40">
          © {SITE.name}. 本サイトの計算結果は概算・参考値です。実際の税額は個別事情により変わります。
        </p>
      </div>
    </footer>
  );
}
