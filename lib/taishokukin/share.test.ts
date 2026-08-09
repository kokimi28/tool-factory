/**
 * 退職金課税ツールの URL 共有ヘルパーのテスト（E3）。
 * 退職理由の復元・フォールバックと真偽フラグの相互変換を固定する。
 */
import { describe, it, expect } from "vitest";
import { parseSeparation, boolToFlag, flagToBool } from "./share";

describe("E3 taishokukin 共有ヘルパー", () => {
  it("退職理由は voluntary / involuntary を復元し、未知値は voluntary", () => {
    expect(parseSeparation("voluntary")).toBe("voluntary");
    expect(parseSeparation("involuntary")).toBe("involuntary");
    expect(parseSeparation("")).toBe("voluntary");
    expect(parseSeparation("xyz")).toBe("voluntary");
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
