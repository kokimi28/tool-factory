import { activeOffers } from "@/lib/tedori/affiliate";

/**
 * アフィリエイト CTA。
 * ASP リンク未取得（activeOffers が空）の間は何も表示しない＝先行公開できる。
 * リンクには rel="sponsored nofollow" と target="_blank" rel="noopener noreferrer" を付与する。
 */
export default function CTA() {
  const offers = activeOffers();
  if (offers.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-label="関連サービス">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-bold text-slate-800">退職金・退職後のお金の相談先</h2>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          PR・広告
        </span>
      </div>
      <ul className="space-y-3">
        {offers.map((offer) => (
          <li key={offer.id}>
            <a
              href={offer.url}
              rel="sponsored nofollow noopener noreferrer"
              target="_blank"
              className="block rounded-xl border border-slate-200 p-4 transition hover:border-brand hover:bg-brand/5"
            >
              <span className="block font-semibold text-brand-dark">{offer.label}</span>
              <span className="mt-1 block text-sm text-slate-600">{offer.description}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        ※本欄には広告（アフィリエイトプログラム）を含みます。掲載は当サイトの判断によるもので、税額の計算結果とは関係ありません。
      </p>
    </section>
  );
}
