/**
 * アフィリエイト案件の定義。
 *
 * 運用ルール（GOVERNANCE / Tool Factory 規約）:
 *  - ASP の案件 URL を取得したら url を埋め、enabled を true にする。
 *  - リンクは常に rel="sponsored nofollow" + target="_blank" rel="noopener noreferrer"（CTA 側で付与）。
 *  - 1ページに表示するのは最大3本まで（activeOffers が slice(0,3)）。
 *  - url 未取得（enabled=false または url="") の案件は表示されない＝「CTA コメントアウト」状態で先行公開できる。
 *  - ⚠ 実URLへの差し替え（url 投入・enabled:true 化）＝収益化トリガー。Vercel Pro 移行の
 *    オーナー判断（STOP: 決済・課金）とセットで行う。CLAUDE.md「収益化トリガー」節を参照。
 */
export interface AffiliateOffer {
  id: string;
  /** CTA の見出し */
  label: string;
  /** 補足説明（1〜2文） */
  description: string;
  /** ASP のアフィリエイトリンク（未取得なら空文字） */
  url: string;
  /** ASP リンク取得後に true にすると表示される */
  enabled: boolean;
}

/**
 * 手取り計算ツールと相性の良い案件の枠（url はオーナーが ASP 取得後に投入）。
 * enabled=false の間は一切表示されない。
 */
export const AFFILIATE_OFFERS: AffiliateOffer[] = [
  {
    id: "tenshoku-agent",
    label: "年収アップの相談をする（転職エージェント）",
    description: "今の年収が適正か、手取りを増やすキャリアの選択肢を無料で相談できます。",
    url: "",
    enabled: false,
  },
  {
    id: "money-consult",
    label: "家計・保険の無料相談（FP相談）",
    description: "手取りに対して固定費が高すぎないか、お金のプロに無料で相談できます。",
    url: "",
    enabled: false,
  },
  {
    id: "furusato",
    label: "ふるさと納税で実質負担を抑える",
    description: "手取りの範囲で節税しながら返礼品を受け取れるふるさと納税を比較できます。",
    url: "",
    enabled: false,
  },
];

/** 表示可能な案件（有効かつ URL あり）を最大3件返す */
export function activeOffers(): AffiliateOffer[] {
  return AFFILIATE_OFFERS.filter((o) => o.enabled && o.url.trim() !== "").slice(0, 3);
}
