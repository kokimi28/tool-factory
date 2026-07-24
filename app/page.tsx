import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools-registry";

export const metadata: Metadata = {
  title: SITE.name,
  description: SITE.description,
  alternates: { canonical: "/" },
};

/**
 * トップ＝ツール一覧ハブ。tools-registry から自動生成する。
 * 公開中（live）はリンク、承認済み未構築（planned）は「準備中」。
 * ツールを1つ足す/公開するだけで、この一覧に自動で載る。
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">{SITE.name}</h1>
        <p className="mt-2 text-black/60">{SITE.description}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => {
          const card = (
            <div className="h-full rounded-xl border border-black/10 p-5">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t.name}</span>
                {t.status === "planned" && (
                  <span className="rounded bg-black/5 px-2 py-0.5 text-xs text-black/50">
                    準備中
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-black/60">{t.description}</p>
            </div>
          );
          return (
            <li key={t.slug}>
              {t.status === "live" ? (
                <Link
                  href={`/${t.slug}`}
                  className="block transition-colors hover:[&>div]:border-black/30"
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-10 text-xs text-black/40">
        本サイトの計算結果は概算・参考値です。法令確認日: {SITE.lawCheckedAt}。
      </p>
    </main>
  );
}
