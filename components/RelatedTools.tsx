import Link from "next/link";
import { relatedTools } from "@/lib/tools-registry";

/**
 * 関連ツール（同一クラスタの他ツール）へのカードリンク。
 * 各ツールページ下部に置く＝相互リンク＝ポートフォリオ連結の実体。
 * tools-registry 起点なので、ツールを1つ足すだけで全ツールに相互リンクが張られる。
 *
 * @param currentSlug 現在のツール slug（自分は除外される）
 */
export default function RelatedTools({ currentSlug }: { currentSlug: string }) {
  const tools = relatedTools(currentSlug);
  if (tools.length === 0) return null;

  return (
    <section aria-labelledby="related-tools" className="mt-12">
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
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
