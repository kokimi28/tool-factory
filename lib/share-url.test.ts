/**
 * URL 共有エンコード／デコードの round-trip テスト（E3）。
 */
import { describe, it, expect } from "vitest";
import { encodeShareParams, decodeShareParams } from "./share-url";

describe("E3 share-url", () => {
  it("encode→decode で元に戻る（round-trip）", () => {
    const params = { income: "5000000", over40: "1" };
    const qs = encodeShareParams(params);
    expect(qs.startsWith("?")).toBe(true);
    expect(decodeShareParams(qs)).toEqual(params);
  });

  it("空値はクエリに含めない", () => {
    expect(encodeShareParams({ income: "", over40: "0" })).toBe("?over40=0");
    expect(encodeShareParams({ income: "", over40: "" })).toBe("");
  });

  it("先頭の ? 有無どちらもデコードできる", () => {
    expect(decodeShareParams("?a=1&b=2")).toEqual({ a: "1", b: "2" });
    expect(decodeShareParams("a=1&b=2")).toEqual({ a: "1", b: "2" });
  });

  it("空文字は空オブジェクト", () => {
    expect(decodeShareParams("")).toEqual({});
    expect(decodeShareParams("?")).toEqual({});
  });
});
