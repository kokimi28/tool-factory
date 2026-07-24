/**
 * tools-registry.ts — 全ツールの登録簿（Tool Factory の連結の起点）
 *
 * ここ1か所を編集すれば、トップのツール一覧ハブ・sitemap・フッター・
 * 関連ツール（RelatedTools）がすべて自動で更新される。
 * 「島を作らない」（portfolio-integration.md 層3）をコード無しで満たす仕組み。
 *
 * 新ツールの追加手順（設定・付与ゼロ）:
 *   1. app/(tools)/<slug>/page.tsx と lib/<slug>/calculations.ts(.test) を追加
 *   2. 下の TOOLS に1行足し status を 'live' にする
 *   → ハブ・sitemap・相互リンクに自動反映。PR が `check` green で自走マージ。
 *
 * status:
 *   'live'    … ルートが存在し公開中（ハブでリンク・sitemap に載る）
 *   'planned' … 承認済み・未構築（ハブで「準備中」表示・sitemap 除外）
 *
 * 正本: dev-env docs/dev-env/tool-factory-consolidation.md
 */

export type ToolStatus = "live" | "planned";

export type Tool = {
  /** ルートセグメント。/(tools)/<slug> と lib/<slug>/ に対応 */
  slug: string;
  /** 表示名（ハブ・タイトル用） */
  name: string;
  /** 短いラベル（フッター・関連ツールのチップ用） */
  short: string;
  /** メタ説明・ハブの1行紹介 */
  description: string;
  /** クラスタ（相互リンクのまとまり。当面は税のみ） */
  cluster: "tax";
  status: ToolStatus;
};

export const TOOLS: Tool[] = [
  {
    slug: "taishokukin",
    name: "退職金の税金シミュレーター",
    short: "退職金の手取り",
    description:
      "退職金額と勤続年数から退職所得控除・所得税・住民税・手取りを計算。役員退職金・短期勤続・iDeCo併用にも対応。",
    cluster: "tax",
    status: "live",
  },
  {
    slug: "ideco",
    name: "iDeCo受取税シミュレーター",
    short: "iDeCoの受取税",
    description:
      "iDeCo・企業型DCの一時金と退職金の受取順序・間隔による退職所得控除の重複調整と手取りを試算。",
    cluster: "tax",
    status: "live",
  },
  {
    slug: "tedori",
    name: "年収の手取り計算シミュレーター",
    short: "年収の手取り",
    description:
      "年収から社会保険料・所得税・住民税を差し引いた手取り額を計算する単機能ツール。",
    cluster: "tax",
    status: "live",
  },
  {
    slug: "furusato",
    name: "ふるさと納税 限度額シミュレーター",
    short: "ふるさと納税の限度額",
    description:
      "年収・家族構成から、自己負担2,000円で済むふるさと納税の控除上限額（目安）を計算。",
    cluster: "tax",
    status: "live",
  },
  {
    slug: "jutaku-loan",
    name: "住宅ローン控除シミュレーター",
    short: "住宅ローン控除",
    description:
      "借入額・年収から住宅ローン控除の各年の控除額と期間総額を試算（省エネ要件・改正対応）。",
    cluster: "tax",
    status: "live",
  },
  {
    slug: "nenshu-kabe",
    name: "年収の壁 手取り逆転シミュレーター",
    short: "年収の壁",
    description:
      "103・106・130・150万円の「壁」ごとに、超えた場合の手取りの逆転と回復ラインを可視化。",
    cluster: "tax",
    status: "live",
  },
  {
    slug: "nenkin-kuriage",
    name: "年金 繰上げ・繰下げ 損益分岐シミュレーター",
    short: "年金の繰上げ繰下げ",
    description:
      "受給開始年齢ごとの年金総額と、繰上げ・繰下げの損益分岐となる年齢を試算。",
    cluster: "tax",
    status: "planned",
  },
];

/** 公開中（ルートあり）のツールのみ。ハブのリンク・sitemap・相互リンクが参照。 */
export function liveTools(): Tool[] {
  return TOOLS.filter((t) => t.status === "live");
}

/** slug からツールを引く。 */
export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/**
 * 関連ツール（同一クラスタの公開中ツールから自分を除く）。
 * 各ツールページ下部の RelatedTools が使う＝相互リンク＝連結の実体。
 */
export function relatedTools(slug: string): Tool[] {
  const self = getTool(slug);
  const cluster = self?.cluster ?? "tax";
  return liveTools().filter((t) => t.slug !== slug && t.cluster === cluster);
}
