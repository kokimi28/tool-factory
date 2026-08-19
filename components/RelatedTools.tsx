import Link from "next/link";
import LinkPending from "@/components/LinkPending";
import { relatedTools } from "@/lib/tools-registry";
import { nextStep } from "@/lib/next-step";

/**
 * 関連ツール（同一クラスタの他ツール）へのカードリンク。
 * 各ツールページ下部に置く＝相互リンク＝ポートフォリオ連結の実体。
 * tools-registry 起点なので、ツールを1つ足すだけで全ツールに相互リンクが張られる。
 *
 * 先頭に「次の一手」の文脈リンク（E11）を1つだけ強調表示する（結果を見た後の導線）。
 *
 * @param currentSlug 現在のツール slug（自分は除外される）
 */
export default function RelatedTools({ currentSlug }: { currentSlug: string }) {
  const tools = relatedTools(currentSlug);
  if (tools.length === 0) return null;

  const next = nextStep(currentSlug);

  return (
    <section aria-labelledby="related-tools" className="mt-12">
      {next && (
        <Link
          href={`/${next.slug}`}
          className="mb-6 block rounded-xl border border-blue-200 bg-blue-50 p-4 transition-colors hover:border-blue-400"
        >
          <span className="text-xs font-semibold text-blue-600">次の一手</span>
          <span className="mt-0.5 block font-semibold text-blue-900">{next.label} →</span>
          <span className="mt-1 block text-sm text-blue-800/80">{next.reason}</span>
          <LinkPending />
        </Link>
      )}
      <h2 id="related-tools" className="text-lg font-bold mb-3">
        関連する計算ツール
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/${t.slug}`}
              className="block rounded-lg border border-black/10 p-4 hover:border-black/30 transition-colors"
            >
              <span className="font-semibold">{t.name}</span>
              <span className="mt-1 block text-sm text-black/60">
                {t.description}
              </span>
              <LinkPending />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
