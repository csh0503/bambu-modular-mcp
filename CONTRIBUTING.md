# Contributing Print Recipes & Improvements / 貢獻與分享列印配置指南

First of all, thank you! **The built-in presets and modifiers in `bambu-modular-mcp` were initially compiled and synthesized from online slicer wikis and community guides — NOT tested one by one across every printer and filament brand by a single person.** Your real-world print experience is what makes this project better for everyone.

非常感謝你的參與！本專案目前的內建參數是從網路上的公開教學、切片維基與社群討論整理合成而來，**並非由作者逐台機器、逐款耗材親自實印試出來的**。因此，非常需要大家把實際印過、覺得更好用的參數分享出來，一起把這套積木庫打磨得更準確！

---

## Two Easy Ways to Share Your Settings / 兩種超簡單的分享方式

### 1. Don't want to touch code? Open a Recipe Issue!（免寫程式：直接開 Issue 貼參數）
Click **[Issues → New Issue → Share / Improve a Print Preset or Modifier](../../issues/new/choose)** and tell us:
- Which printer & nozzle you used (e.g., `P1S 0.4mm`, `A1 mini 0.2mm`, `P2S 0.6mm`)
- Which filament brand & material you printed (e.g., `Bambu PETG HF`, `Polymaker ASA`, `eSUN PLA+`)
- Which parameters worked better (or what went wrong with the current preset)

We will fold it into the preset engine or `community-presets/` and credit your GitHub handle!

### 2. Submit a JSON Recipe Pull Request（提交 JSON 積木檔 PR）
1. Copy `community-presets/_example_preset.json.example` to `community-presets/presets/<your_preset>.json` (or `community-presets/modifiers/<your_modifier>.json`).
2. Fill in `tested_on`, `source_or_notes`, and your Bambu Studio `process` / `filament` overrides (`by_nozzle` and `by_material` are supported automatically!).
3. Open a Pull Request — the MCP server automatically discovers all `.json` files in those folders at startup.
