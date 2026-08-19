/**
 * 読み込み中の共通スケルトン（auto-backlog F12）。
 *
 * App Router の loading.tsx は Suspense の fallback として使われる。
 * ページごとに書くと形も文言もばらつくので、ここ1箇所に置いて
 * app/loading.tsx と app/(tools)/loading.tsx から使う。
 *
 * a11y: 支援技術には「読み込み中」と1度だけ伝え、飾りのブロックは読み上げない
 * （aria-hidden）。動きは prefers-reduced-motion を尊重する（motion-safe:）。
 */
export default function LoadingSkeleton({
  /** 見出しの下に並べる行数。ページの密度に合わせる */
  lines = 6,
  /** 計算フォームの枠（2カラム）を出すか */
  withPanel = false,
}: {
  lines?: number;
  withPanel?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className="animate-none">
      <span className="sr-only">読み込み中</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-7 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse" />
        <div className="h-4 w-full rounded bg-slate-100 motion-safe:animate-pulse" />
        {withPanel && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-64 rounded-2xl border border-slate-200 bg-slate-50 motion-safe:animate-pulse" />
            <div className="h-64 rounded-2xl border border-slate-200 bg-slate-50 motion-safe:animate-pulse" />
          </div>
        )}
        <div className="space-y-2">
          {Array.from({ length: lines }, (_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-slate-100 motion-safe:animate-pulse"
              style={{ width: `${100 - (i % 3) * 12}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
