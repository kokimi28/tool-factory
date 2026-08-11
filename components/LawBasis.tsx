import { SITE } from "@/lib/site";

/**
 * 法令根拠＋最終確認日の共通表示（F8・2巡目）。
 * 最終確認日はサイト共通の SITE.lawCheckedAt を単一ソースにし、
 * 法的根拠の文言だけツールごとに渡す（表示の体裁を統一）。
 */
export default function LawBasis({ basis }: { basis: string }) {
  return (
    <p className="mt-10 text-xs text-gray-400 leading-relaxed">
      {basis}　最終確認日 {SITE.lawCheckedAt}。税制改正・料率改定により内容が変わる場合があります。本サイトの計算結果は概算・参考値です。
    </p>
  );
}
