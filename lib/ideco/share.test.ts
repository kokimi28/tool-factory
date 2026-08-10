/**
 * iDeCo受取税ツールの URL 共有ヘルパーのテスト（E3）。
 * RawInputs ↔ クエリの round-trip と、空クエリで空の部分更新になることを固定する。
 */
import { describe, it, expect } from "vitest";
import { encodeIdecoInputs, decodeIdecoInputs } from "./share";
import { IDECO_PRESETS, type IdecoPresetInputs } from "./presets";

describe("E3 ideco 共有ヘルパー", () => {
  it("RawInputs → クエリ → RawInputs で一致する（全プリセットで）", () => {
    for (const preset of IDECO_PRESETS) {
      const restored = decodeIdecoInputs(encodeIdecoInputs(preset.inputs));
      expect(restored).toEqual(preset.inputs);
    }
  });

  it("任意の RawInputs も round-trip する", () => {
    const raw: IdecoPresetInputs = {
      nyushaYear: "2000",
      taishokuYear: "2035",
      taishokuMan: "1800",
      idecoStartYear: "2010",
      idecoReceiptYear: "2033",
      idecoMan: "600",
      idecoEndYear: "2032",
    };
    expect(decodeIdecoInputs(encodeIdecoInputs(raw))).toEqual(raw);
  });

  it("空クエリは空の部分更新（既存 state を壊さない）", () => {
    expect(decodeIdecoInputs({})).toEqual({});
  });
});
