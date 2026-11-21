# bambu-modular-mcp 🧩

**Ultra-fast 4-Tool Modular Slicing & Print Control MCP Server for All Bambu Lab 3D Printers**  
**支援拓竹全系列機型的「4 工具積木式」極速切片與遠端控制 MCP 伺服器**

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.18-339933.svg)](https://nodejs.org/)

---

> ### ⚠️ Honest Disclaimer on Print Profiles & Call for Community Recipes / 關於列印配置的誠實聲明與共創邀請
>
> **English:** The built-in scene presets and stackable modifiers in this project were **researched, compiled, and synthesized from publicly available online resources** (such as Bambu Lab Official Wiki, OrcaSlicer documentation, Ellis' Print Tuning Guide, CNC Kitchen extrusion studies, and community forum discussions) — **they were NOT individually bench-tested one by one across every printer, nozzle, and filament by the author.** Because ambient humidity, filament batches, and machine setups vary, please treat them as smart starting baselines and check your preview & first layer.  
> **We warmly encourage you to upload, correct, or share your own battle-tested print configurations!** You can drop a simple `.json` file into [`community-presets/`](./community-presets/README.md) via PR, or submit your settings in 1 minute via our **[Share a Print Recipe Issue Form](../../issues/new/choose)** — no coding required!
>
> **繁體中文：** 本專案內建的 10 大場景基底與 14 款功能積木參數，**是從網路上的公開技術指南、官方 Wiki 與社群討論整理彙編而成，並非由作者逐一親手實印測試過每一種組合**。不同品牌的耗材批次、環境濕度與機況皆有差異，請將其視為高效率的起點，開印前務必確認預覽圖與首層狀態。  
> **非常歡迎大家上傳或分享自己實測好用的打印配置來一起完善這個 MCP！** 不管是直接放一個 `.json` 到 [`community-presets/`](./community-presets/README.md) 發 PR，或直接在 **[GitHub Issues 配方分享表單](../../issues/new/choose)** 貼上你的參數截圖／數值都非常歡迎！

---

## Why `bambu-modular-mcp`? / 為什麼推倒重做這套 MCP？

Traditional 3D printer MCP servers expose **50+ granular low-level tools** directly to the LLM. Every print request forces the AI to make 5–8 round-trips: polling verbose MQTT JSONs, reading giant parameter manuals, writing custom override files, slicing, re-inspecting temperatures, and extracting previews — burning thousands of tokens and taking minutes.

`bambu-modular-mcp` collapses the entire workflow into **just 4 ultra-lean tools** and a **4-Layer Modular Parameter Engine**:

1. **`bambu_slice_modular`** — **Single-call ~6s pipeline**: reads live printer model, nozzle size/flow type, and multi-AMS trays (`A1–D4`) ➔ sanitizes multi-slot residue in `.3mf` files ➔ synthesizes **1 Scene Preset + N Stackable Modifiers** (automatically branching PLA vs. PETG rules, open-frame vs. enclosed warnings, and printer-specific speed vector lengths) ➔ slices via Bambu Studio CLI ➔ verifies G-code temperatures, weight & ETA ➔ exports preview PNGs (including headless Linux G-code rendering) + a clean 5-line confirmation card.
2. **`bambu_start_print`** — Dispatches a verified `job_id` **only after user confirmation**, automatically enforcing a 30-second post-cancel firmware cooldown and verifying the printer enters `RUNNING`.
3. **`bambu_status`** — 98% smaller token footprint than raw MQTT dumps: live nozzle, temperatures, progress/ETA, multi-AMS colors & remaining %, plus optional chamber light toggle or `.3mf` plate inspection.
4. **`bambu_control`** — Pause, resume, safe cancel, skip failed objects mid-print, and chamber light on/off.

---

## Supported Bambu Lab Printers & Nozzles / 支援機型與噴嘴

- **Enclosed CoreXY & Dual-Nozzle**: `X1C`, `X1`, `X1E`, `P1S`, `P2S` *(includes automatic SD-root FTPS & post-cancel state patches)*, `H2D`, `H2D Pro`, `H2S`, `H2C`, `X2D`
- **Open-Frame / Bedslingers**: `P1P`, `A1`, `A1 mini` *(auto-adjusts bed temps, enables tall-part height slowdown on bedslingers, and warns on warp-prone ABS/ASA/PC/PA)*
- **Nozzle Diameters**: `0.2mm` *(with automatic hard-block against CF/GF/Wood/Glow/Marble clogs)*, `0.4mm`, `0.6mm`, `0.8mm` (Standard & High-Flow hotends)
- **AMS**: Single AMS (`A1–A4`), Multi-AMS (`A1–D4`, slots `0–15`), and External Spool (`254`)

---

## Modular Building Blocks / 積木式參數組合一覽

### Layer 2: Primary Scene Presets (`preset` — pick 1)
| Preset | Purpose / 適用場景 |
|---|---|
| `structural` | Everyday functional brackets & parts (3 walls, gyroid infill, inner-outer-inner) / 日常結構件預設 |
| `heavy_duty` | High-load mounts & screw brackets (5 walls, 30% gyroid, widened lines, +5°C) / 耐摔高承重鎖螺絲件 |
| `fine_smooth` | Smooth cosmetic surfaces (finer layers, constant Z outer-wall speed, combined infill) / 細膩平滑外觀件 |
| `safe_fast` | Fast prototyping capped safely within standard hotend volumetric flow / 零結塊安全極速打樣 |
| `miniature` | 28mm miniatures, `<3mm` text & stamps (Arachne, low speed, slim tree support) / 微縮公仔與細字 |
| `precision_fit` | Snap-fits, bearings & screw bores (precise outer wall + auto XY hole compensation) / 卡榫軸承精配 |
| `articulated` | Print-in-place articulated toys & hinges (zero brim to prevent fused joints) / 一體成型活動關節 |
| `watertight` | Planters, cups & floats (5 walls, 6 top/bottom shells, 1.02 flow ratio, +5°C) / 防水抗滲容器 |
| `vase` | Seamless spiral vase mode with thickened single wall (`0.65–1.10mm`) / 加厚強韌螺旋花瓶 |
| `author_3mf` | Preserves original `.3mf` wall/infill/support choices while enforcing safe temps / 保留原作者幾何設定 |

### Layer 3: Stackable Modifiers (`modifiers` — combine freely!)
| Modifier | Smart Material-Aware Behavior / 自動材質防呆行為 |
|---|---|
| `scarf_seam` | Conditional contour scarf seam on PLA; switches to back seam + 10% gap on PETG to avoid scarf valleys |
| `aligned_seam` | Hides seams inside sharp corners on rectangular enclosures |
| `ironing` | Smooth top-surface ironing (`30mm/s + 10%` low-flow anti-ooze baseline on top layers) |
| `fuzzy_skin` | External-only Perlin micro-matte skin (`0.06mm / 0.35mm`) — keeps internal screw/bearing holes smooth |
| `overhang_pro` | Switches wall order to `inner/outer`, `0.90` bridge flow, and disables false shallow-curve slowdowns |
| `support_tree_easy` | Build-plate-only slim tree supports with wider anti-weld Z/XY spacing automatically applied for PETG |
| `support_normal_snug` | Snug normal supports for flat stepped overhangs |
| `support_bimat_zero` | Zero-Z-gap multi-material support interface via AMS (auto-pairs `PLA ⇄ PETG` + interface ironing) |
| `counterbore_bridge` | 1-layer sacrificial bridge on downward counterbored screw holes (no support digging needed) |
| `brim_anti_warp` | `8mm` outer brim + height-based slowdown for tall thin parts or ABS/ASA/PC |
| `brim_ears` | Easy-peel corner mouse ears |
| `by_object` | Print-by-object sequence to eliminate cross-part travel stringing |
| `silk_mirror` | Locks outer wall to constant `45mm/s` and `lockedzag` infill to eliminate sheen banding & Silk curve bulges |
| `clear_glass` | 100% single-direction rectilinear, `35mm/s` zero-fan recipe for translucent PETG |

*(Plus any community `.json` files placed inside [`community-presets/`](./community-presets/README.md)!)*

---

## Quick Start / 快速安裝與設定

### Prerequisites / 前置需求
1. **Node.js `>= 18.18`**
2. **[Bambu Studio](https://bambulab.com/en/download/studio)** installed locally (Windows, macOS, or Linux AppImage/Flatpak CLI)
3. **LAN Only Mode** enabled on your Bambu Lab printer (gives you the Printer IP, Serial Number, and 8-char LAN Access Code)

### Install / 安裝
```bash
git clone https://github.com/csh0503/bambu-modular-mcp.git
cd bambu-modular-mcp
npm install
```
*(Running `npm install` automatically installs the underlying Bambu LAN/3MF driver and applies the P2S FTPS root upload & cancel-state patches.)*

### MCP Client Configuration (`mcp_config.json` / Claude Desktop / Cursor / Antigravity)
```json
{
  "mcpServers": {
    "bambu": {
      "command": "node",
      "args": ["/absolute/path/to/bambu-modular-mcp/index.mjs"],
      "env": {
        "PRINTER_HOST": "192.168.1.100",
        "BAMBU_MODEL": "p1s",
        "BAMBU_SERIAL": "YOUR_PRINTER_SERIAL",
        "BAMBU_TOKEN": "YOUR_LAN_ACCESS_CODE",
        "SLICER_PATH": "C:\\Program Files\\Bambu Studio\\bambu-studio.exe",
        "BAMBU_LANGUAGE": "en"
      }
    }
  }
}
```

### Optional Environment Variables / 進階選填環境變數
- `BAMBU_LANGUAGE`: `"en"` (English confirmation card) or `"zh-TW"` (Traditional Chinese confirmation card, default).
- `BAMBU_PROFILES_ROOT`: Custom path to Bambu Studio's `BBL/` system profiles directory (auto-detected on Windows/macOS/Linux).
- `BAMBU_SSH_BRIDGE_TARGET` & `BAMBU_SSH_BRIDGE_PORT`: Optional SSH jump target (e.g. `user@127.0.0.1` + port `2222`) to automatically tunnel `8883`/`990` when a desktop VPN blocks direct LAN access.
- `BAMBU_CUSTOM_PRESETS_DIR`: Additional directory to load custom preset/modifier JSON files from.
- `BAMBU_TOOL_PREFIX`: Tool name prefix (defaults to `bambu` -> `bambu_slice_modular`, etc.).

---

## Credits & License / 致謝與開源授權

- Built on top of the LAN MQTT/FTPS, 3MF inspection, and G-code preview foundations of **[DMontgomery40/bambu-printer-mcp](https://github.com/DMontgomery40/bambu-printer-mcp)** (David Montgomery & contributors).
- Parameter heuristics inspired by public documentation from **Bambu Lab Wiki**, **OrcaSlicer Wiki**, **Ellis' Print Tuning Guide**, and **CNC Kitchen**.
- Licensed under **[GNU General Public License v2.0 (GPL-2.0)](./LICENSE)**.
