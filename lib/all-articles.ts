/**
 * 全ツール横断の記事一覧（QC4・auto-backlog Tier C）。
 *
 * 各ツールが個別に持つ /(tools)/<slug>/articles を、サイト直下の集約ページ /articles が
 * 1か所に束ねるためのデータ源。tools-registry を正としてツール名を引き、記事は各ツールの
 * articles.ts から取り込む（記事本文の二重管理はしない＝参照だけ集約）。
 *
 * 記事の型は2系統ある:
 *   - 6ツール（ARTICLES 配列・updated）
 *   - tedori（getAllArticles()・updatedAt）
 * ここで両者を ArticleCard に正規化して吸収する。新ツールを足したら下の SOURCES に1行足す。
 */
import { getTool } from "./tools-registry";
import { ARTICLES as TAISHOKUKIN } from "./taishokukin/articles";
import { ARTICLES as IDECO } from "./ideco/articles";
import { getAllArticles as tedoriArticles } from "./tedori/articles";
import { ARTICLES as FURUSATO } from "./furusato/articles";
import { ARTICLES as JUTAKU_LOAN } from "./jutaku-loan/articles";
import { ARTICLES as NENSHU_KABE } from "./nenshu-kabe/articles";
import { ARTICLES as NENKIN_KURIAGE } from "./nenkin-kuriage/articles";

/** 集約ページ・sitemap が使う正規化済みの記事カード。 */
export type ArticleCard = {
  /** 所属ツールの slug（/(tools)/<toolSlug>/…） */
  toolSlug: string;
  /** 所属ツールの表示名（tools-registry 由来） */
  toolName: string;
  /** 記事 slug */
  slug: string;
  title: string;
  description: string;
  /** 最終更新日（YYYY-MM-DD） */
  updated: string;
  /** 記事本文への相対パス */
  href: string;
};

/** 1件の記事を集約カードに正規化する。updated の取り出しは呼び出し側で行う（型ごとに違うため）。 */
function toCard(
  toolSlug: string,
  a: { slug: string; title: string; description: string },
  updated: string,
): ArticleCard {
  return {
    toolSlug,
    toolName: getTool(toolSlug)?.name ?? toolSlug,
    slug: a.slug,
    title: a.title,
    description: a.description,
    updated,
    href: `/${toolSlug}/articles/${a.slug}`,
  };
}

/**
 * 全ツールの記事を正規化し、更新日の新しい順（同日はツール名→タイトル）で返す。
 * 純関数・副作用なし（現在日時に依存しない＝ビルドが決定的）。
 * 各ソースは concrete な型のまま map するので updated / updatedAt の差はキャスト無しで吸収できる。
 */
export function allArticles(): ArticleCard[] {
  const cards: ArticleCard[] = [
    ...TAISHOKUKIN.map((a) => toCard("taishokukin", a, a.updated)),
    ...IDECO.map((a) => toCard("ideco", a, a.updated)),
    ...FURUSATO.map((a) => toCard("furusato", a, a.updated)),
    ...JUTAKU_LOAN.map((a) => toCard("jutaku-loan", a, a.updated)),
    ...NENSHU_KABE.map((a) => toCard("nenshu-kabe", a, a.updated)),
    ...NENKIN_KURIAGE.map((a) => toCard("nenkin-kuriage", a, a.updated)),
    ...tedoriArticles().map((a) => toCard("tedori", a, a.updatedAt)),
  ];
  cards.sort((x, y) => {
    if (x.updated !== y.updated) return x.updated < y.updated ? 1 : -1; // 新しい順
    if (x.toolName !== y.toolName) return x.toolName < y.toolName ? -1 : 1;
    return x.title < y.title ? -1 : 1;
  });
  return cards;
}
