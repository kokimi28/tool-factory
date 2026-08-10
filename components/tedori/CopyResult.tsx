"use client";

import { useState } from "react";

/**
 * 結果をテキストでコピーするボタン（E12）。
 * 表示用テキストは server 側で `resultToClipboardText` により生成し、props で受け取る。
 */
export default function CopyResult({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード不可の環境では何もしない。
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="text-sm font-medium text-brand-dark underline underline-offset-2 hover:text-brand"
    >
      {copied ? "結果をコピーしました" : "結果をテキストでコピー"}
    </button>
  );
}
