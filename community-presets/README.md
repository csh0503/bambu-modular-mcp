# Community Print Recipes (`community-presets/`)

You can add your own **Scene Presets** or **Stackable Modifiers** without writing any JavaScript!
只要把 `.json` 配方檔放進這個資料夾，MCP 啟動時就會自動載入並出現在 AI 的選單中，完全不需要改程式碼。

## Folder Structure / 目錄結構
- `community-presets/presets/*.json` — Primary scene baselines (e.g., `tpu_soft_grip.json`, `lithophane.json`).
- `community-presets/modifiers/*.json` — Stackable feature blocks (e.g., `extra_thick_fuzzy.json`, `mouse_ears_12mm.json`).
- Files starting with `_` (such as `_example_preset.json.example`) are templates and ignored at runtime.

## JSON Schema / 欄位說明
```json
{
  "id": "my_recipe_name",
  "title": "Human-readable recipe name",
  "author": "your-github-id",
  "tested_on": ["P1S 0.4mm", "Bambu PETG HF"],
  "source_or_notes": "Where this recipe comes from or why these values work well",
  "nozzle_temp_delta": 0,
  "max_volumetric_speed": 18,
  "process": {
    "wall_loops": "4",
    "sparse_infill_pattern": "gyroid"
  },
  "filament": {},
  "by_nozzle": {
    "0.4": { "process": { "layer_height": "0.16" } },
    "0.6": { "process": { "layer_height": "0.24" } }
  },
  "by_material": {
    "PLA": { "process": { "ironing_flow": "22%" } },
    "PETG": { "process": { "ironing_flow": "10%" } }
  }
}
```

## Share Yours! / 歡迎分享你的實測設定
- **Option A (Pull Request)**: Add your `.json` file under `presets/` or `modifiers/` and open a PR!
- **Option B (No Git needed)**: Open a **[Share / Improve a Print Recipe](../../issues/new/choose)** issue and paste your Bambu Studio values or screenshots — we will convert it into a module and credit you!
