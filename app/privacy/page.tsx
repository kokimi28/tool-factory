import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: `${SITE.name}のプライバシーポリシー。`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
      <p className="text-black/70">
        本サイトは、入力された金額・年数などの情報をサーバーに送信・保存しません
        （計算はすべてブラウザ内で完結します）。
      </p>
      <p className="text-black/70">
        アクセス解析のため Google Analytics を利用する場合があります。取得される
        情報は匿名化され、個人を特定するものではありません。
      </p>
    </div>
  );
}
