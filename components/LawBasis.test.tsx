/**
 * F8 法令根拠表示の妥当性テスト。最終確認日がサイト共通の単一ソース（SITE.lawCheckedAt）で
 * あることと、日付が YYYY-MM-DD 形式であることを固定する（表示の統一・鮮度の単一管理）。
 */
import { describe, it, expect } from "vitest";
import { SITE } from "@/lib/site";

describe("F8 法令根拠・最終確認日の単一ソース", () => {
  it("SITE.lawCheckedAt は YYYY-MM-DD 形式", () => {
    expect(SITE.lawCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
