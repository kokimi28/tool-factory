/**
 * 記事本文の相互参照（別記事へのリンク文言）が実在する記事を指しているかのゲート。
 *
 * 記事は Link を張らず「別記事「…」」と本文で名指しするだけなので、参照先の記事タイトルを
 * 変えても・存在しない記事名を書いても、型でもビルドでも検出できない。実際、
 * shoyo-tedori は存在しない「40歳から引かれる介護保険料」を、shokyu-tedori-fueni-kui は
 * 存在しない「額面から引かれるものの内訳（社会保険料・税金）」を指していた。
 *
 * 記事名は本文で短縮して引くことがある（例:「年収の手取りはどう決まる？」）ため、
 * 「実在するどれかのタイトルの先頭一致」を合格条件にする。ただし途中で切ると意味が変わるので、
 * 短縮は区切り（？ ｜ （ 。）の位置か全文でなければならない。
 */
import { describe, it, expect } from "vitest";
import { getAllArticles } from "./articles";

/** 本文が「別記事「…」」の形で名指ししている記事名を抜き出す */
const CITATION_RE = /別記事「([^」]+)」/g;
/** 「別記事「A」と「B」で」のように 2 本目以降が 別記事 を伴わずに続くケース */
const FOLLOWING_RE = /」と「([^」]+)」/g;
/** 「…は「A」で解説」の形（別記事 を伴わないが記事名を指している） */
const EXPLAIN_RE = /「([^」]*(?:手取り|内訳|年収|ボーナス|賞与|介護保険)[^」]*)」(?:で|も)(?:解説|参照|くわしく|詳しく)/g;

const collect = (text: string, re: RegExp): string[] =>
  [...text.matchAll(new RegExp(re.source, "g"))].map((m) => m[1]);

describe("記事の相互参照は実在する記事タイトルを指す", () => {
  const articles = getAllArticles();
  const titles = articles.map((a) => a.title);

  /** 短縮を許す区切り。ここ以外で切ると意味が変わるので先頭一致でも不合格にする */
  const DELIMITERS = ["？", "｜", "（", "、"];

  /**
   * 引用文言が実在タイトルの「区切りまでの先頭一致」または全文かどうか。
   * 例:「年収の手取りはどう決まる？」は「年収の手取りはどう決まる？額面から引かれる…」に合格
   *    （引用が区切り「？」で終わっている）。
   *    「年収別の手取り額の目安」は「…目安（300万・…）」に合格（続きが区切り「（」）。
   *    「40歳から引かれる介護保険料」はどのタイトルの先頭でもないので不合格。
   */
  const resolves = (cited: string): boolean =>
    titles.some((t) => {
      if (t === cited) return true;
      if (!t.startsWith(cited)) return false;
      // 境界が区切りにあること（引用の末尾が区切り、またはタイトルの続きが区切り）
      return DELIMITERS.includes(cited[cited.length - 1]) || DELIMITERS.includes(t[cited.length]);
    });

  for (const article of articles) {
    const body = article.sections.flatMap((s) => s.paragraphs).join("\n");
    const cited = [
      ...collect(body, CITATION_RE),
      ...collect(body, FOLLOWING_RE),
      ...collect(body, EXPLAIN_RE),
    ];
    // 「年収÷12」のような記事名でない引用は上の抽出に混ざりうるので、
    // 「どのタイトルの先頭でもない」ものだけを落とすのではなく、
    // 記事名として引かれた文言（別記事/解説 の直近）だけを対象にしている。
    for (const c of new Set(cited)) {
      it(`${article.slug}: 「${c}」`, () => {
        expect(resolves(c), `「${c}」に一致する記事タイトルがない`).toBe(true);
      });
    }
  }

  it("slug は一意・タイトルは一意（先頭一致の判定が曖昧にならない）", () => {
    expect(new Set(articles.map((a) => a.slug)).size).toBe(articles.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("shoyo-tedori が参照する3記事はすべて実在する（Defect B の回帰防止）", () => {
    const shoyo = articles.find((a) => a.slug === "shoyo-tedori");
    expect(shoyo).toBeDefined();
    const body = shoyo!.sections.flatMap((s) => s.paragraphs).join("\n");
    for (const [cited, slug] of [
      ["40歳になると手取りが減る？介護保険料と手取りへの影響", "kaigo-hoken-40sai-tedori"],
      ["年収の手取りはどう決まる？額面から引かれるお金の仕組み", "tedori-shikumi"],
      ["社会保険料の内訳は？", "shakai-hoken-uchiwake-tedori"],
      ["手取り月額は「年収÷12」ではない", "tedori-getsugaku-nenshu-12"],
    ] as const) {
      expect(body).toContain(cited);
      expect(articles.find((a) => a.slug === slug)!.title.startsWith(cited)).toBe(true);
    }
    // 存在しない記事名を指していた旧文言が復活しないこと
    expect(body).not.toContain("「40歳から引かれる介護保険料」");
  });
});
