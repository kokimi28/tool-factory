/**
 * 文脈リンク（E11・2巡目）。各ツールから「次の一手」として最も自然な1ツールを
 * 理由つきで指す curated マップ。RelatedTools の先頭に強調表示する（結果を見た後の導線）。
 * 汎用の関連ツール一覧（relatedTools）とは別に、"次はこれ" を1つだけ提示するのが狙い。
 */
import { getTool } from "./tools-registry";

export type NextStep = {
  /** 遷移先ツールの slug */
  slug: string;
  /** リンクの見出し（行動を促す文言） */
  label: string;
  /** なぜ次にこれなのかの一言 */
  reason: string;
};

const NEXT_STEP: Record<string, NextStep> = {
  tedori: {
    slug: "furusato",
    label: "ふるさと納税の限度額を計算",
    reason: "手取りが分かったら、自己負担2,000円で寄付できる上限もチェック。",
  },
  furusato: {
    slug: "tedori",
    label: "年収の手取りを計算",
    reason: "限度額のもとになる年収の手取り・課税所得も確認。",
  },
  "nenshu-kabe": {
    slug: "tedori",
    label: "年収の手取りを詳しく計算",
    reason: "壁を越えた後の年収で、手取りの内訳を詳しく確認。",
  },
  taishokukin: {
    slug: "ideco",
    label: "iDeCoとの受取順を試算",
    reason: "退職金とiDeCoは受け取る順序・間隔で税額が変わる。",
  },
  ideco: {
    slug: "taishokukin",
    label: "退職金だけの手取りを計算",
    reason: "退職金を単体で受け取る場合の手取りも確認。",
  },
  "jutaku-loan": {
    slug: "furusato",
    label: "ふるさと納税の限度額を計算",
    reason: "住宅ローン控除と併用すると、ふるさと納税の上限が削れることがある。",
  },
  "nenkin-kuriage": {
    slug: "tedori",
    label: "手取り計算で税・社保を確認",
    reason: "年金・給与にかかる税と社会保険料の感覚を手取り計算でつかむ。",
  },
};

/**
 * 現在のツールに対する「次の一手」。遷移先が未登録なら null（安全側）。
 * @param slug 現在のツール slug
 */
export function nextStep(slug: string): NextStep | null {
  const ns = NEXT_STEP[slug];
  if (!ns) return null;
  const target = getTool(ns.slug);
  if (!target || target.status !== "live" || ns.slug === slug) return null;
  return ns;
}
