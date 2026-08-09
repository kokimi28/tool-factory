/**
 * 受取シナリオ・プリセット（E2・2巡目）。iDeCo は西暦×多フィールドの入力モデルのため、
 * 単数値ではなく「シナリオ丸ごと」をワンタップで入力する。
 * Calculator（フォーム復元）とテスト（妥当性の固定）で共有する。
 *
 * 各シナリオは代表的な受取パターン（重複あり・2026改正・同年合算・間隔十分）を1件ずつ用意する。
 * 値は Calculator の RawInputs と同じ文字列フィールド（西暦・万円）。
 */
export type IdecoPresetInputs = {
  nyushaYear: string;
  taishokuYear: string;
  taishokuMan: string;
  idecoStartYear: string;
  idecoReceiptYear: string;
  idecoMan: string;
  idecoEndYear: string;
};

export type IdecoPreset = {
  label: string;
  description: string;
  inputs: IdecoPresetInputs;
};

export const IDECO_PRESETS: IdecoPreset[] = [
  {
    label: "退職金→iDeCo（重複あり）",
    description: "退職金を先に受け取り、その後2年でiDeCoを受給（19年ルールで調整）",
    inputs: {
      nyushaYear: "1995",
      taishokuYear: "2025",
      taishokuMan: "2000",
      idecoStartYear: "2015",
      idecoReceiptYear: "2027",
      idecoMan: "500",
      idecoEndYear: "",
    },
  },
  {
    label: "iDeCo→退職金（2026改正）",
    description: "iDeCoを先に受け取り、その後に退職金（10年ルールの調整対象）",
    inputs: {
      nyushaYear: "1995",
      taishokuYear: "2030",
      taishokuMan: "2000",
      idecoStartYear: "2015",
      idecoReceiptYear: "2028",
      idecoMan: "500",
      idecoEndYear: "",
    },
  },
  {
    label: "同年に両方",
    description: "退職金とiDeCoを同じ年に受け取る（勤続期間を通算して合算）",
    inputs: {
      nyushaYear: "1995",
      taishokuYear: "2025",
      taishokuMan: "2000",
      idecoStartYear: "2015",
      idecoReceiptYear: "2025",
      idecoMan: "500",
      idecoEndYear: "",
    },
  },
  {
    label: "間隔を十分に空ける",
    description: "退職金の受給から20年空けてiDeCoを受給（重複調整なし）",
    inputs: {
      nyushaYear: "1990",
      taishokuYear: "2020",
      taishokuMan: "2000",
      idecoStartYear: "2022",
      idecoReceiptYear: "2040",
      idecoMan: "500",
      idecoEndYear: "",
    },
  },
];
