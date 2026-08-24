/**
 * サイト URL の不変条件テスト（Q-SEO）。
 *
 * canonical / sitemap / robots / JSON-LD / metadataBase はすべて SITE.url を
 * 基点に絶対 URL を生成する。ここが壊れる形は 2 つあり、**Q-SEO #9 は片方だけを
 * 直して、もう片方を作った**:
 *
 *   A. 未所有ドメインを指す → canonical が他人のサイトを向き検索評価を明け渡す
 *   B. 自分のホストだが **noindex** を返す → 全ページが検索から除外される
 *
 * #9 は A を塞ぐために「実在する本番エイリアス」を選んだが、選んだのが Vercel の
 * **チームスコープ URL**（`<project>-<team>-projects-<hash>.vercel.app`）で、
 * これは `x-robots-tag: noindex` を返す＝B に落ちていた。2026-08-23 実測時点で
 * 7ツール・記事73本が丸ごと検索対象外だった。
 *
 * B は**ホスト名の形から機械的に判定できる**（チームスコープ URL だけが noindex）
 * ので、URL 文字列そのものを見るテストで塞げる。ネットワークには依存させない
 * （CI で外部 fetch はしない）。固定するもの:
 *   - A: 未所有の `tool-factory.vercel.app` を指さない
 *   - B: チームスコープ URL の形を指さない（本 PR の回帰ガード）
 *   - 絶対 https・末尾スラッシュ無し（相対結合の事故防止）
 *   - new URL() で metadataBase として解釈できる
 *
 * per-tool の派生 URL（`${SITE.url}/<slug>`）は `@/` 別名を使うため vitest から
 * 直接 import できない（vite alias 未設定）。派生はテンプレートリテラルで自明な
 * ため、基点である SITE.url の健全性をここで固定すれば連鎖して保証される。
 */
import { describe, it, expect } from "vitest";
import { SITE } from "./site";

describe("SITE.url の不変条件（Q-SEO）", () => {
  it("未所有ドメイン tool-factory.vercel.app を指さない（回帰ガード）", () => {
    // 既定が他者占有の疑いがあるドメインだと canonical が明け渡しになる。
    expect(SITE.url).not.toContain("//tool-factory.vercel.app");
  });

  it("noindex を返すチームスコープ URL を指さない（Q-SEO #9 の回帰ガード）", () => {
    // Vercel は `<project>-<team>-projects-<hash>.vercel.app` に
    // x-robots-tag: noindex を付ける。ここを canonical にすると、正しく自分の
    // サイトを指しているのに全ページが検索から消える。
    expect(SITE.url).not.toMatch(/-[a-z0-9-]+-projects-[0-9a-f]{6,}\.vercel\.app/);
  });

  it("既定はチームスコープでない本番エイリアスである", () => {
    // 環境変数で上書きされていない素の既定を見る（上書き時はそちらが正）。
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      expect(SITE.url).toBe("https://tool-factory-five.vercel.app");
    }
  });

  it("絶対 https で末尾スラッシュを持たない", () => {
    expect(SITE.url).toMatch(/^https:\/\//);
    expect(SITE.url.endsWith("/")).toBe(false);
  });

  it("new URL() で metadataBase として解釈できる", () => {
    expect(() => new URL(SITE.url)).not.toThrow();
  });
});
