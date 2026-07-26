/**
 * サイト URL の不変条件テスト（Q-SEO）。
 *
 * canonical / sitemap / robots / JSON-LD / metadataBase はすべて SITE.url を
 * 基点に絶対 URL を生成する。ここが未所有ドメインを指すと canonical が他人の
 * サイトを向き検索評価を明け渡すため、以下を CI で固定する:
 *   - 既定 URL は未所有の `tool-factory.vercel.app` を指さない（本バグの回帰ガード）
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

  it("絶対 https で末尾スラッシュを持たない", () => {
    expect(SITE.url).toMatch(/^https:\/\//);
    expect(SITE.url.endsWith("/")).toBe(false);
  });

  it("new URL() で metadataBase として解釈できる", () => {
    expect(() => new URL(SITE.url)).not.toThrow();
  });
});
