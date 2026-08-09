/**
 * ふるさと納税ツールの URL 共有ヘルパーのテスト（E3）。
 * モード・フラグの相互変換とフォールバックを固定する。
 */
import { describe, it, expect } from "vitest";
import { parseMode, boolToFlag, flagToBool } from "./share";

describe("E3 furusato 共有ヘルパー", () => {
  it("モードは salary / taxable を復元し、未知値は salary", () => {
    expect(parseMode("salary")).toBe("salary");
    expect(parseMode("taxable")).toBe("taxable");
    expect(parseMode("")).toBe("salary");
    expect(parseMode("xyz")).toBe("salary");
  });

  it("真偽フラグは round-trip する", () => {
    expect(flagToBool(boolToFlag(true))).toBe(true);
    expect(flagToBool(boolToFlag(false))).toBe(false);
  });

  it("フラグは '1' のときだけ true", () => {
    expect(flagToBool("1")).toBe(true);
    expect(flagToBool("0")).toBe(false);
    expect(flagToBool("")).toBe(false);
  });
});
