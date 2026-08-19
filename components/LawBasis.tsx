/**
 * 法令根拠＋最終確認日の共通表示（auto-backlog F8）。
 *
 * **checkedAt を必須にしている理由**: 以前はサイト共通の `SITE.lawCheckedAt` を
 * 既定値にしていたが、法令の確認日はツールごとに実際に違う（各ツールの
 * `site-meta.ts` が持つ）。既定値があると、寄せ替えた瞬間にそのツールが
 * 「確認していない日付」を表示してしまう。実際に退職金ツールで起きていて、
 * 自分の記録（2026-05-19）より2か月新しい日付（2026-07-24）を出していた。
 * 省略できないようにして、呼び出し側に必ずそのツールの日付を書かせる。
 */
export default function LawBasis({
  /** 法令根拠の文言（ツールごと） */
  basis,
  /** そのツールが法令を最終確認した日（YYYY-MM-DD）。site-meta.ts の値を渡す */
  checkedAt,
}: {
  basis: string;
  checkedAt: string;
}) {
  return (
    <p className="mt-10 text-xs text-gray-500 leading-relaxed">
      {basis}　最終確認日 {checkedAt}。税制改正・料率改定により内容が変わる場合があります。本サイトの計算結果は概算・参考値です。
    </p>
  );
}
