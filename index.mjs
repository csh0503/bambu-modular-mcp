#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  PRINTER_CATALOG,
  PRESET_NAMES,
  MODIFIER_NAMES,
  resolvePrinterSpec,
  normalizeNozzle,
  detectSystemBblDir,
  classifyMaterial,
  buildModularProfiles,
} from "./presets-engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// 1. Dependency Resolution (Standard local node_modules OR shared vendor root)
// ============================================================================
function findNodeModulesRoot() {
  const candidates = [
    path.join(__dirname, "node_modules"),
    process.env.BAMBU_MCP_VENDOR_ROOT,
  ].filter(Boolean);

  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, "@modelcontextprotocol", "sdk")) &&
      fs.existsSync(path.join(dir, "bambu-printer-mcp", "dist"))
    ) {
      return dir;
    }
  }
  throw new Error(
    `Dependencies not found. Run "npm install" inside ${__dirname} (or set BAMBU_MCP_VENDOR_ROOT).`
  );
}

const MODULES_DIR = findNodeModulesRoot();
const pkgRequire = createRequire(path.join(MODULES_DIR, "bambu-printer-mcp", "package.json"));
const importPkg = (spec) => import(pathToFileURL(pkgRequire.resolve(spec)).href);
const importSub = (relPath) => import(pathToFileURL(path.join(MODULES_DIR, relPath)).href);

const { Server } = await importPkg("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = await importPkg("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = await importPkg("@modelcontextprotocol/sdk/types.js");
const jszipMod = await importPkg("jszip");
const JSZip = jszipMod.default || jszipMod;
const { STLManipulator } = await importSub("bambu-printer-mcp/dist/stl/stl-manipulator.js");
const { BambuImplementation } = await importSub("bambu-printer-mcp/dist/printers/bambu.js");
const { inspectPrintFile } = await importSub("bambu-printer-mcp/dist/safety/print-file.js");
const { previewPrintFile } = await importSub("bambu-printer-mcp/dist/safety/print-preview.js");
const { slicedFileFacts } = await importSub("bambu-printer-mcp/dist/counterpart/sliced-file.js");
const { listModelPlates } = await importSub("bambu-printer-mcp/dist/counterpart/model-plates.js");
const { analyze3MFPlateObjects } = await importSub("bambu-printer-mcp/dist/3mf_parser.js");

// ============================================================================
// 2. Runtime Configuration & Optional VPN Split-Tunnel SSH Bridge
// ============================================================================
const PRINTER_HOST = (process.env.BAMBU_PRINTER_HOST || process.env.PRINTER_HOST || "").trim();
const BAMBU_SERIAL = (process.env.BAMBU_PRINTER_SERIAL || process.env.BAMBU_SERIAL || "").trim();
const BAMBU_TOKEN = (process.env.BAMBU_PRINTER_ACCESS_TOKEN || process.env.BAMBU_TOKEN || "").trim();
const DEFAULT_MODEL = (process.env.BAMBU_MODEL || "").trim();
const SLICER_TYPE = (process.env.SLICER_TYPE || "bambustudio").trim();
const SLICER_PATH = (
  process.env.SLICER_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Bambu Studio\\bambu-studio.exe"
    : process.platform === "darwin"
      ? "/Applications/BambuStudio.app/Contents/MacOS/BambuStudio"
      : "bambu-studio")
).trim();

const TOOL_PREFIX = (process.env.BAMBU_TOOL_PREFIX || "bambu").trim().replace(/_+$/, "");
const LANG = (process.env.BAMBU_LANGUAGE || "zh-TW").toLowerCase().startsWith("en") ? "en" : "zh";

const SSH_BRIDGE_TARGET = (process.env.BAMBU_SSH_BRIDGE_TARGET || "").trim();
const SSH_BRIDGE_PORT = (process.env.BAMBU_SSH_BRIDGE_PORT || "22").trim();

const WORK_ROOT = process.env.TEMP_DIR
  ? path.resolve(process.env.TEMP_DIR)
  : path.join(os.tmpdir(), "bambu-modular-mcp");
const JOBS_DIR = path.join(WORK_ROOT, "jobs");
fs.mkdirSync(JOBS_DIR, { recursive: true });

const PREVIEW_HOST_DIR = process.env.BAMBU_PREVIEW_DIR
  ? path.resolve(process.env.BAMBU_PREVIEW_DIR)
  : path.join(WORK_ROOT, "previews");
const PREVIEW_ALIAS_DIR = (process.env.BAMBU_PREVIEW_ALIAS_DIR || "").trim();
fs.mkdirSync(PREVIEW_HOST_DIR, { recursive: true });

/**
 * Optional semicolon-separated prefix mappings for containerized agents, e.g.:
 * BAMBU_PATH_MAP="/container/Downloads/=/host/Downloads/;/container/workspace/=/host/workspace/"
 */
const PATH_MAPPINGS = (process.env.BAMBU_PATH_MAP || "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((pair) => {
    const idx = pair.indexOf("=");
    return idx > 0 ? { from: pair.slice(0, idx), to: pair.slice(idx + 1) } : null;
  })
  .filter(Boolean);

const bambu = new BambuImplementation();
const stlManipulator = new STLManipulator(WORK_ROOT);
const BBL_DIR = detectSystemBblDir(process.env.BAMBU_PROFILES_ROOT);

let sshBridgeProc = null;
let cachedStatus = null;
let cachedStatusAt = 0;
let lastCancelAt = 0;

function probeTcp(host, port, timeoutMs = 450) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    try {
      sock.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

async function resolveEffectiveHost() {
  if (!PRINTER_HOST) {
    throw new Error("PRINTER_HOST (or BAMBU_PRINTER_HOST) environment variable is not set.");
  }
  if (await probeTcp(PRINTER_HOST, 8883, 450)) {
    return PRINTER_HOST;
  }
  // Optional SSH tunnel fallback when VPN split-tunneling blocks direct LAN access
  if (SSH_BRIDGE_TARGET && PRINTER_HOST !== "127.0.0.1") {
    if (await probeTcp("127.0.0.1", 8883, 250)) {
      return "127.0.0.1";
    }
    const bridgeHost = SSH_BRIDGE_TARGET.includes("@")
      ? SSH_BRIDGE_TARGET.split("@")[1]
      : SSH_BRIDGE_TARGET;
    if (await probeTcp(bridgeHost, Number(SSH_BRIDGE_PORT), 400)) {
      if (!sshBridgeProc || sshBridgeProc.killed) {
        sshBridgeProc = spawn(
          "ssh",
          [
            "-o", "BatchMode=yes",
            "-o", "StrictHostKeyChecking=no",
            "-o", "ExitOnForwardFailure=yes",
            "-N",
            "-p", SSH_BRIDGE_PORT,
            "-L", `127.0.0.1:8883:${PRINTER_HOST}:8883`,
            "-L", `127.0.0.1:990:${PRINTER_HOST}:990`,
            SSH_BRIDGE_TARGET,
          ],
          { stdio: "ignore", windowsHide: true }
        );
        sshBridgeProc.unref();
      }
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (await probeTcp("127.0.0.1", 8883, 250)) {
          return "127.0.0.1";
        }
      }
    }
  }
  return PRINTER_HOST;
}

function cleanupBridge() {
  if (sshBridgeProc && !sshBridgeProc.killed) {
    try {
      sshBridgeProc.kill();
    } catch {}
  }
}
process.once("exit", cleanupBridge);
process.once("SIGINT", () => { cleanupBridge(); process.exit(130); });
process.once("SIGTERM", () => { cleanupBridge(); process.exit(143); });

// ============================================================================
// 3. Compact Status Formatter (98% Smaller Token Footprint + Multi-AMS Support)
// ============================================================================
const BENIGN_HMS_CODES = new Set(["0500_0300_0001_000A", "0500-0300-0001-000A"]);

function colorNameFromHex(hexRaw) {
  const hex = String(hexRaw || "").replace(/^#/, "").slice(0, 6).toUpperCase();
  if (!hex || hex.length < 6) return LANG === "en" ? "Unknown" : "未知色";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const pick = (zh, en) => (LANG === "en" ? en : zh);
  if (r > 230 && g > 230 && b > 230) return pick("白色", "White");
  if (r < 35 && g < 35 && b < 35) return pick("黑色", "Black");
  if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18) return pick("灰色", "Gray");
  if (r > 210 && g > 180 && b < 80) return pick("黃色", "Yellow");
  if (r > 200 && g < 120 && b > 90) return pick("粉紅色", "Pink");
  if (r > 190 && g < 70 && b < 70) return pick("紅色", "Red");
  if (r < 60 && g > 90 && b > 120) return pick("藍色", "Blue");
  if (r < 80 && g > 150 && b < 100) return pick("綠色", "Green");
  if (r > 210 && g > 100 && g <= 180 && b < 60) return pick("橘色", "Orange");
  return `#${hex}`;
}

function summarizeStatus(st, hostUsed) {
  const fallbackSpec = resolvePrinterSpec(DEFAULT_MODEL, BAMBU_SERIAL);
  if (!st || !st.connected) {
    return {
      connected: false,
      printer_model: fallbackSpec.id,
      printer_name: fallbackSpec.displayName,
      status: st?.status || "ERROR",
      error: st?.error || "Printer unreachable",
      host_used: hostUsed,
    };
  }
  const raw = st.raw || {};
  const detectedSpec = resolvePrinterSpec(DEFAULT_MODEL || st.model, st.observedSerial || BAMBU_SERIAL);
  const nozzleDiameter = normalizeNozzle(raw.nozzle_diameter || 0.4);
  const nozzleType = String(raw.nozzle_type || "HS01");
  const flowMode =
    /hh|high_flow|hf/i.test(nozzleType) || String(raw.nozzleFlows || "").toLowerCase().includes("high")
      ? "high_flow"
      : "standard";

  const amsUnits = Array.isArray(st.ams?.ams) ? st.ams.ams : [];
  const trays = [];
  for (const unit of amsUnits) {
    const unitIdx = Number(unit?.id ?? 0);
    const unitLetter = String.fromCharCode(65 + Math.min(25, Math.max(0, unitIdx)));
    for (const t of unit?.tray || []) {
      if (!t || (!t.tray_type && !t.tray_sub_brands)) continue;
      const trayInUnit = Number(t.id);
      const absSlot = unitIdx * 4 + trayInUnit;
      const hex = `#${String(t.tray_color || t.cols?.[0] || "FFFFFF").slice(0, 6).toUpperCase()}`;
      trays.push({
        slot: absSlot,
        label: `${unitLetter}${trayInUnit + 1}`,
        material: t.tray_type || "UNKNOWN",
        brand_variant: t.tray_sub_brands || t.tray_type || "Generic",
        filament_id: t.tray_info_idx || "",
        color_name: colorNameFromHex(hex),
        color_hex: hex,
        remain_pct: typeof t.remain === "number" && t.remain >= 0 ? t.remain : null,
      });
    }
  }

  const fmtHms = (n) => {
    const hex = (Number(n) >>> 0).toString(16).toUpperCase().padStart(8, "0");
    return `${hex.slice(0, 4)}_${hex.slice(4, 8)}`;
  };
  const hmsList = Array.isArray(raw.hms)
    ? raw.hms
        .map((h) => `${fmtHms(h.attr)}_${fmtHms(h.code)}`)
        .filter((code) => code !== "0000_0000_0000_0000" && !BENIGN_HMS_CODES.has(code))
    : [];

  const lightReport = Array.isArray(raw.lights_report)
    ? raw.lights_report.find((l) => l.node === "chamber_light")?.mode
    : undefined;

  return {
    connected: true,
    printer_model: detectedSpec.id,
    printer_name: detectedSpec.displayName,
    host_used: hostUsed === "127.0.0.1" && PRINTER_HOST !== "127.0.0.1" ? "127.0.0.1 (via SSH bridge)" : hostUsed,
    status: st.status,
    nozzle: {
      diameter_mm: nozzleDiameter,
      hardware_code: nozzleType,
      flow_mode: flowMode,
    },
    temperatures_c: {
      nozzle: `${Math.round(st.temperatures?.nozzle?.actual ?? 0)} / ${Math.round(st.temperatures?.nozzle?.target ?? 0)}`,
      bed: `${Math.round(st.temperatures?.bed?.actual ?? 0)} / ${Math.round(st.temperatures?.bed?.target ?? 0)}`,
      chamber: Math.round(st.temperatures?.chamber ?? 0),
    },
    chamber_light: lightReport || "unknown",
    active_job:
      st.status === "RUNNING" || st.status === "PAUSE" || st.status === "PREPARE"
        ? {
            filename: st.print?.filename || "None",
            progress_pct: st.print?.progress ?? 0,
            remaining_min: st.print?.timeRemaining ?? 0,
            layer: `${st.print?.currentLayer ?? 0}/${st.print?.totalLayers ?? 0}`,
          }
        : null,
    ams_trays: trays,
    hms_alerts: hmsList,
  };
}

async function getCompactStatus(forceFresh = false) {
  if (!PRINTER_HOST || !BAMBU_SERIAL || !BAMBU_TOKEN) {
    const spec = resolvePrinterSpec(DEFAULT_MODEL, BAMBU_SERIAL);
    return {
      connected: false,
      printer_model: spec.id,
      printer_name: spec.displayName,
      status: "UNCONFIGURED",
      error: "PRINTER_HOST / BAMBU_SERIAL / BAMBU_TOKEN not configured (offline slice-only mode).",
    };
  }
  const now = Date.now();
  if (!forceFresh && cachedStatus && now - cachedStatusAt < 12000) {
    return cachedStatus;
  }
  const host = await resolveEffectiveHost();
  const rawSt = await bambu.getStatus(host, BAMBU_SERIAL, BAMBU_TOKEN);
  const compact = summarizeStatus(rawSt, host);
  if (compact.connected) {
    cachedStatus = compact;
    cachedStatusAt = now;
  }
  return compact;
}

// ============================================================================
// 4. 3MF Pre-Sanitizer & Dual Preview Extractor (Desktop PNG + Headless G-code)
// ============================================================================
async function prepareInputModel(inputPath, singleColorClean = true) {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== ".3mf") {
    return { cleanPath: inputPath, authorSettings: null, cleanup: () => {} };
  }
  const buf = await fs.promises.readFile(inputPath);
  const zip = await JSZip.loadAsync(buf);

  let authorSettings = null;
  const projEntry = zip.file("Metadata/project_settings.config");
  if (projEntry) {
    try {
      authorSettings = JSON.parse(await projEntry.async("string"));
    } catch {}
  }

  let modified = false;
  for (const name of Object.keys(zip.files)) {
    if (/^Metadata\/plate_\d+\.gcode(\.md5)?$/i.test(name)) {
      zip.remove(name);
      modified = true;
    }
  }

  if (singleColorClean) {
    const modelCfg = zip.file("Metadata/model_settings.config");
    if (modelCfg) {
      const xml = await modelCfg.async("string");
      const normalized = xml.replace(/(<metadata\s+key="extruder"\s+value=")[2-9]\d*("\s*\/>)/gi, "$11$2");
      if (normalized !== xml) {
        zip.file("Metadata/model_settings.config", normalized);
        modified = true;
      }
    }
  }

  if (!modified) {
    return { cleanPath: inputPath, authorSettings, cleanup: () => {} };
  }

  const stagedPath = path.join(WORK_ROOT, `staged_${randomUUID()}_${path.basename(inputPath)}`);
  const outBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.promises.writeFile(stagedPath, outBuf);
  return {
    cleanPath: stagedPath,
    authorSettings,
    cleanup: () => fs.promises.unlink(stagedPath).catch(() => {}),
  };
}

async function extractSlicedPreviews(sliced3mfPath, plateIndex, jobId, filamentColours = []) {
  const plateNum = plateIndex + 1;
  const buf = await fs.promises.readFile(sliced3mfPath);
  const zip = await JSZip.loadAsync(buf);
  const wanted = [
    { zipKey: `Metadata/plate_${plateNum}.png`, suffix: "plate.png" },
    { zipKey: `Metadata/top_${plateNum}.png`, suffix: "top.png" },
  ];

  const hostPaths = [];
  const aliasPaths = [];
  for (const w of wanted) {
    const entry = zip.file(w.zipKey);
    if (!entry) continue;
    const pngBuf = await entry.async("nodebuffer");
    if (pngBuf.length < 200) continue;
    const fileName = `${jobId}_${w.suffix}`;
    const hostOut = path.join(PREVIEW_HOST_DIR, fileName);
    await fs.promises.writeFile(hostOut, pngBuf);
    hostPaths.push(hostOut);
    if (PREVIEW_ALIAS_DIR) {
      aliasPaths.push(path.posix.join(PREVIEW_ALIAS_DIR.replace(/\\/g, "/"), fileName));
    }
  }

  // Headless Linux fallback: render directly from sliced G-code when OpenGL PNGs are absent
  if (hostPaths.length === 0) {
    const gcodeEntry = zip.file(`Metadata/plate_${plateNum}.gcode`);
    if (gcodeEntry) {
      const gcodeText = await gcodeEntry.async("string");
      const rendered = await previewPrintFile({
        gcode: gcodeText,
        projectColours: filamentColours.length ? filamentColours : undefined,
      }).catch(() => null);
      if (rendered?.views?.length) {
        for (const v of rendered.views) {
          const fileName = `${jobId}_${v.name}.png`;
          const hostOut = path.join(PREVIEW_HOST_DIR, fileName);
          await fs.promises.writeFile(hostOut, Buffer.from(v.png_base64, "base64"));
          hostPaths.push(hostOut);
          if (PREVIEW_ALIAS_DIR) {
            aliasPaths.push(path.posix.join(PREVIEW_ALIAS_DIR.replace(/\\/g, "/"), fileName));
          }
        }
      }
    }
  }
  return { hostPaths, aliasPaths };
}

function formatDuration(seconds) {
  const s = Math.max(1, Math.round(Number(seconds || 0)));
  const h = Math.floor(s / 3600);
  const m = Math.max(1, Math.round((s % 3600) / 60));
  if (LANG === "en") return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
  return h > 0 ? `約 ${h} 小時 ${m} 分` : `約 ${m} 分`;
}

const INFILL_LABELS_ZH = {
  gyroid: "螺旋",
  crosshatch: "交叉孵化",
  adaptivecubic: "自適應立方",
  lightning: "閃電",
  concentric: "同心圓",
  alignedrectilinear: "單向直線",
};

function resolveHostModelPath(rawPath) {
  const p = String(rawPath || "").trim();
  if (!p) throw new Error("model_path is empty.");
  for (const m of PATH_MAPPINGS) {
    if (p.startsWith(m.from)) {
      const mapped = p.replace(m.from, m.to);
      if (fs.existsSync(mapped)) return mapped;
    }
  }
  if (!fs.existsSync(p)) {
    throw new Error(`Model file not found: ${p}`);
  }
  return p;
}

// ============================================================================
// 5. MCP Server Definition (4 Ultra-Lean Modular Tools)
// ============================================================================
const server = new Server(
  { name: "bambu-modular-mcp", version: "2.1.0" },
  { capabilities: { tools: {} } }
);

const SUPPORTED_MODELS = Object.keys(PRINTER_CATALOG);

const TOOLS = [
  {
    name: `${TOOL_PREFIX}_slice_modular`,
    description:
      "All-in-one modular Bambu Lab slicer & verifier: reads live printer nozzle & AMS trays, composes scene preset + stackable modifiers (auto-resolving PLA/PETG differences & volumetric speed limits), slices via Bambu Studio CLI, verifies G-code temperatures/grams/time, and exports preview images + confirmation card.",
    inputSchema: {
      type: "object",
      required: ["model_path"],
      properties: {
        model_path: { type: "string", description: "Absolute path to input .3mf or .stl file." },
        printer_model: {
          type: "string",
          enum: SUPPORTED_MODELS,
          description: "Optional Bambu printer model override (auto-detected from live printer or BAMBU_MODEL env).",
        },
        nozzle_diameter: {
          type: "string",
          enum: ["0.2", "0.4", "0.6", "0.8"],
          description: "Optional nozzle size override in mm (auto-detected from live printer when connected).",
        },
        ams_slot: {
          type: "integer",
          description: "AMS tray index: 0=A1, 1=A2, 2=A3, 3=A4 (4..15 for AMS B/C/D), or 254=external spool.",
        },
        material: {
          type: "string",
          description: "Target material (e.g. PLA / PETG / ASA / ABS / TPU / PC / PA) when ams_slot is omitted.",
        },
        preset: {
          type: "string",
          enum: PRESET_NAMES,
          default: "structural",
          description:
            "Primary scene preset: structural | heavy_duty | fine_smooth | safe_fast | miniature | precision_fit | articulated | watertight | vase | author_3mf (plus any custom JSON presets in community-presets/presets).",
        },
        modifiers: {
          type: "array",
          items: { type: "string", enum: MODIFIER_NAMES },
          description:
            "Stackable feature modifiers: scarf_seam | aligned_seam | ironing | fuzzy_skin | overhang_pro | support_tree_easy | support_normal_snug | support_bimat_zero | counterbore_bridge | brim_anti_warp | brim_ears | by_object | silk_mirror | clear_glass (plus custom JSON modifiers).",
        },
        bed_leveling: { type: "boolean", default: false, description: "Enable auto bed leveling when starting print." },
        model_display_name: { type: "string", description: "Friendly display name shown in the confirmation card." },
        makerworld_url: { type: "string", description: "Optional source model URL embedded into the confirmation card." },
        plate_index: { type: "integer", default: 0, description: "0-based plate index for multi-plate .3mf files." },
        copies: { type: "integer", description: "Number of copies to arrange on the plate." },
        skip_objects: { type: "string", description: "Comma-separated object IDs to exclude." },
        arrange: { type: "boolean", default: true, description: "Auto-arrange & center objects on the build plate." },
        orient: { type: "boolean", description: "Auto-orient objects for flattest print bed contact." },
        rotate_x: { type: "number", description: "X rotation in degrees." },
        rotate_y: { type: "number", description: "Y rotation in degrees." },
        rotate_z: { type: "number", description: "Z rotation in degrees." },
        scale: { type: "number", description: "Uniform scale factor (e.g. 1.0)." },
        pause_at_layers: { type: "array", items: { type: "integer" }, description: "1-based layer numbers to insert pause (for magnets/nuts)." },
        layer_height: { type: "number", description: "Micro-override: layer height (mm)." },
        wall_loops: { type: "integer", description: "Micro-override: wall loop count." },
        infill_percent: { type: "number", description: "Micro-override: sparse infill percentage (0-100)." },
        infill_pattern: { type: "string", description: "Micro-override: gyroid | crosshatch | adaptivecubic | lightning | concentric." },
        brim_width: { type: "number", description: "Micro-override: brim width in mm (0 disables brim)." },
        xy_hole_compensation: { type: "number", description: "Micro-override: XY internal hole compensation in mm." },
        multi_color: { type: "boolean", default: false, description: "Set true to preserve multi-color extruder assignments in .3mf." },
        support_filament_slot: { type: "integer", description: "AMS slot index for support interface when using support_bimat_zero." },
        raw_process_overrides: { type: "object", description: "Escape hatch: raw Bambu Studio process JSON key-values." },
        raw_filament_overrides: { type: "object", description: "Escape hatch: raw Bambu Studio filament JSON key-values." },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_start_print`,
    description:
      "Dispatches a sliced print job after explicit user confirmation using job_id from slice_modular (or sliced_3mf_path), enforcing post-cancel 30s firmware cooldown and verifying RUNNING state.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "job_id returned by slice_modular." },
        sliced_3mf_path: { type: "string", description: "Fallback: direct path to a .gcode.3mf file." },
        ams_slots: { type: "array", items: { type: "integer" }, description: "Override AMS slot mapping (e.g. [0] for A1)." },
        bed_leveling: { type: "boolean", description: "Override bed leveling flag." },
        flow_calibration: { type: "boolean", default: false, description: "Enable flow calibration." },
        plate_index: { type: "integer", description: "Override 0-based plate index." },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_status`,
    description:
      "Fast compact printer status: model, live nozzle size & flow mode, temperatures, active print progress/ETA, multi-AMS filament slots & remaining %, optional chamber light toggle or .3mf plate inspection.",
    inputSchema: {
      type: "object",
      properties: {
        chamber_light: { type: "string", enum: ["on", "off"], description: "Optionally turn chamber light on or off." },
        inspect_3mf_path: { type: "string", description: "Optionally list plates and objects inside a .3mf file." },
        force_refresh: { type: "boolean", default: true, description: "Fetch fresh live MQTT report." },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_control`,
    description: "Control active print or printer hardware: pause, resume, cancel (starts 30s safety cooldown), skip_objects, light_on, light_off.",
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: ["pause", "resume", "cancel", "light_on", "light_off", "skip_objects"],
          description: "Control action to execute.",
        },
        object_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Object IDs to skip when action is skip_objects.",
        },
      },
    },
  },
];

function canonicalAction(toolName) {
  const m = /^(?:bambu|p2s)_(slice_modular|start_print|status|control)$/.exec(String(toolName || ""));
  if (m) return m[1];
  if (toolName.startsWith(`${TOOL_PREFIX}_`)) return toolName.slice(TOOL_PREFIX.length + 1);
  return toolName;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const actionKind = canonicalAction(name);

  try {
    // ========================================================================
    // TOOL 1: status
    // ========================================================================
    if (actionKind === "status") {
      if (args.chamber_light === "on" || args.chamber_light === "off") {
        const host = await resolveEffectiveHost();
        await bambu.setLight(host, BAMBU_SERIAL, BAMBU_TOKEN, "chamber_light", args.chamber_light);
      }
      const st = await getCompactStatus(args.force_refresh !== false);
      let modelInfo = undefined;
      if (args.inspect_3mf_path) {
        const mp = resolveHostModelPath(args.inspect_3mf_path);
        const plates = await listModelPlates(mp, { thumbnails: false });
        const plate0Objects = await analyze3MFPlateObjects(mp, 0).catch(() => null);
        modelInfo = { plates, plate0_objects: plate0Objects };
      }
      const payload = { ...st, ...(modelInfo ? { model_3mf_info: modelInfo } : {}) };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }

    // ========================================================================
    // TOOL 2: control
    // ========================================================================
    if (actionKind === "control") {
      const host = await resolveEffectiveHost();
      const act = String(args.action);
      let res;
      if (act === "pause") {
        res = await bambu.pauseJob(host, BAMBU_SERIAL, BAMBU_TOKEN);
      } else if (act === "resume") {
        res = await bambu.resumeJob(host, BAMBU_SERIAL, BAMBU_TOKEN);
      } else if (act === "cancel") {
        res = await bambu.cancelJob(host, BAMBU_SERIAL, BAMBU_TOKEN);
        lastCancelAt = Date.now();
      } else if (act === "light_on" || act === "light_off") {
        res = await bambu.setLight(host, BAMBU_SERIAL, BAMBU_TOKEN, "chamber_light", act === "light_on" ? "on" : "off");
      } else if (act === "skip_objects") {
        if (!Array.isArray(args.object_ids) || !args.object_ids.length) {
          throw new Error("object_ids array is required for skip_objects.");
        }
        res = await bambu.skipObjects(host, BAMBU_SERIAL, BAMBU_TOKEN, args.object_ids.map(Number));
      } else {
        throw new Error(`Unsupported control action: ${act}`);
      }
      cachedStatusAt = 0;
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, action: act, result: res }, null, 2) }] };
    }

    // ========================================================================
    // TOOL 3: slice_modular
    // ========================================================================
    if (actionKind === "slice_modular") {
      const modelPath = resolveHostModelPath(args.model_path);
      const st = await getCompactStatus(false).catch(() => ({ connected: false }));

      const activeModelId = args.printer_model || st.printer_model || DEFAULT_MODEL || "p2s";
      const printerSpec = resolvePrinterSpec(activeModelId, BAMBU_SERIAL);
      const nozzle = args.nozzle_diameter
        ? normalizeNozzle(args.nozzle_diameter)
        : st.connected
          ? st.nozzle.diameter_mm
          : normalizeNozzle(process.env.BAMBU_DEFAULT_NOZZLE || "0.4");
      const flowMode = st.connected ? st.nozzle.flow_mode : "standard";
      const trays = st.connected ? st.ams_trays : [];

      let chosenTray = null;
      let chosenSlot = args.ams_slot !== undefined ? Number(args.ams_slot) : undefined;

      if (chosenSlot !== undefined && chosenSlot >= 0 && chosenSlot < 16) {
        chosenTray = trays.find((t) => t.slot === chosenSlot) || null;
      } else if (chosenSlot === undefined) {
        const wantMat = String(args.material || "PLA").trim().toUpperCase();
        const matching = trays.filter((t) => t.material.toUpperCase().includes(wantMat));
        if (matching.length > 0) {
          matching.sort((a, b) => (b.remain_pct ?? 50) - (a.remain_pct ?? 50));
          chosenTray = matching[0];
          chosenSlot = chosenTray.slot;
        } else if (trays.length > 0) {
          chosenTray = trays[0];
          chosenSlot = chosenTray.slot;
        } else {
          chosenSlot = 0;
        }
      }

      const rawTrayForClassify = chosenTray
        ? {
            tray_type: chosenTray.material,
            tray_sub_brands: chosenTray.brand_variant,
            tray_info_idx: chosenTray.filament_id,
          }
        : { tray_type: args.material || "PLA" };

      const matInfo = classifyMaterial(rawTrayForClassify, args.material || "PLA");
      const modifiers = Array.isArray(args.modifiers) ? args.modifiers : [];
      const isBimat = modifiers.includes("support_bimat_zero");
      const singleColorClean = !isBimat && args.multi_color !== true;

      const { cleanPath, authorSettings, cleanup } = await prepareInputModel(modelPath, singleColorClean);
      const jobId = randomUUID().slice(0, 8);
      const tmpProcPath = path.join(WORK_ROOT, `proc_${jobId}.json`);
      const tmpFil1Path = path.join(WORK_ROOT, `fil1_${jobId}.json`);
      const tmpFil2Path = path.join(WORK_ROOT, `fil2_${jobId}.json`);

      try {
        const built = buildModularProfiles({
          bblDir: BBL_DIR,
          printerModel: printerSpec.id,
          printerSerial: BAMBU_SERIAL,
          nozzle,
          flowMode,
          matInfo,
          preset: args.preset || "structural",
          modifiers,
          overrides: {
            layer_height: args.layer_height,
            wall_loops: args.wall_loops,
            infill_percent: args.infill_percent,
            infill_pattern: args.infill_pattern,
            brim_width: args.brim_width,
            xy_hole_compensation: args.xy_hole_compensation,
            raw_process: args.raw_process_overrides,
            raw_filament: args.raw_filament_overrides,
          },
          authorSettings,
        });

        await fs.promises.writeFile(tmpProcPath, JSON.stringify(built.processProfile, null, 2), "utf8");
        await fs.promises.writeFile(tmpFil1Path, JSON.stringify(built.filamentProfile, null, 2), "utf8");

        let loadFilamentsArg = tmpFil1Path;
        let amsSlotsForJob = chosenSlot === 254 ? [] : [chosenSlot ?? 0];

        if (isBimat) {
          let supSlot = args.support_filament_slot !== undefined ? Number(args.support_filament_slot) : undefined;
          let supTray = supSlot !== undefined ? trays.find((t) => t.slot === supSlot) : null;
          if (!supTray) {
            const targetSupportMat = matInfo.family === "PLA" ? "PETG" : "PLA";
            supTray = trays.find((t) => t.material.toUpperCase().includes(targetSupportMat)) || null;
            supSlot = supTray ? supTray.slot : ((chosenSlot ?? 0) + 1) % 4;
          }
          const supMatInfo = classifyMaterial(
            supTray
              ? { tray_type: supTray.material, tray_sub_brands: supTray.brand_variant, tray_info_idx: supTray.filament_id }
              : { tray_type: matInfo.family === "PLA" ? "PETG" : "PLA" }
          );
          const supBuilt = buildModularProfiles({
            bblDir: BBL_DIR,
            printerModel: printerSpec.id,
            printerSerial: BAMBU_SERIAL,
            nozzle,
            flowMode,
            matInfo: supMatInfo,
            preset: "structural",
          });
          await fs.promises.writeFile(tmpFil2Path, JSON.stringify(supBuilt.filamentProfile, null, 2), "utf8");
          loadFilamentsArg = `${tmpFil1Path};${tmpFil2Path}`;
          amsSlotsForJob = [chosenSlot ?? 0, supSlot];
        }

        const plateIndex = args.plate_index !== undefined ? Number(args.plate_index) : 0;
        const sliceOpts = {
          uptodate: true,
          ensureOnBed: true,
          arrange: args.arrange !== undefined ? Boolean(args.arrange) : true,
          loadFilaments: loadFilamentsArg,
          bedType: "textured_plate",
          nozzleType: "hardened_steel",
          nozzleVolumeType: flowMode === "high_flow" ? "High Flow" : "Standard",
          ...(isBimat ? { allowMixTemp: true } : {}),
          ...(args.orient !== undefined ? { orient: Boolean(args.orient) } : {}),
          ...(args.copies !== undefined ? { repetitions: Number(args.copies) } : {}),
          ...(args.skip_objects ? { skipObjects: String(args.skip_objects) } : {}),
          ...(args.rotate_x !== undefined ? { rotateX: Number(args.rotate_x) } : {}),
          ...(args.rotate_y !== undefined ? { rotateY: Number(args.rotate_y) } : {}),
          ...(args.rotate_z !== undefined ? { rotate: Number(args.rotate_z) } : {}),
          ...(args.scale !== undefined ? { scale: Number(args.scale) } : {}),
          ...(Array.isArray(args.pause_at_layers) && args.pause_at_layers.length
            ? { pauseAtLayers: args.pause_at_layers.map(Number), slicePlate: plateIndex + 1 }
            : args.plate_index !== undefined
              ? { slicePlate: plateIndex + 1 }
              : {}),
        };

        const printerPreset = `${printerSpec.machinePrefix} ${nozzle} nozzle`;
        const sliced = await stlManipulator.sliceSTLWithResult(
          cleanPath,
          SLICER_TYPE,
          SLICER_PATH,
          tmpProcPath,
          undefined,
          printerPreset,
          sliceOpts
        );

        const inspection = await inspectPrintFile(sliced.path, {
          model: printerSpec.id,
          nozzleDiameters: [Number(nozzle)],
          plateIndex,
          bedType: "textured_plate",
        }).catch(() => ({ materials: [matInfo.family], maxNozzleTemperature: built.summary.nozzleTemp }));

        const facts = await slicedFileFacts(sliced.path, plateIndex).catch(() => null);
        const previewColors = chosenTray?.color_hex ? [chosenTray.color_hex] : ["#E0E0E0"];
        const previews = await extractSlicedPreviews(sliced.path, plateIndex, jobId, previewColors);

        const grams = Number(facts?.estimate?.grams ?? sliced?.slicer_result?.filament_weight ?? inspection?.grams ?? 0);
        const seconds = Number(facts?.estimate?.seconds ?? sliced?.slicer_result?.print_time ?? inspection?.seconds ?? 0);
        const timeStr = formatDuration(seconds);
        const gramsStr = grams > 0 ? `${grams.toFixed(1)}g` : LANG === "en" ? "Verified" : "已驗證";

        if (chosenTray && chosenTray.remain_pct !== null && chosenTray.remain_pct <= 8) {
          built.warnings.push(
            LANG === "en"
              ? `Tray ${chosenTray.label} has only ~${chosenTray.remain_pct}% remaining.`
              : `${chosenTray.label} 料槽剩餘量僅約 ${chosenTray.remain_pct}%，請留意是否足夠完成列印。`
          );
        }
        if (st.connected && (st.status === "RUNNING" || st.status === "PAUSE")) {
          built.warnings.push(
            LANG === "en"
              ? `Printer is currently busy (${st.active_job?.filename || st.status}); wait until finished and clear the plate.`
              : `印表機目前正在執行任務（${st.active_job?.filename || st.status}），須等當前任務結束並清床後再開印。`
          );
        }

        const bedLeveling = Boolean(args.bed_leveling ?? false);
        const displayName =
          args.model_display_name ||
          path.basename(modelPath, path.extname(modelPath)).replace(/^0\d_/, "").replace(/_/g, " ") +
            (args.copies && Number(args.copies) > 1 ? ` ×${args.copies}` : "");
        const mwSuffix = args.makerworld_url
          ? LANG === "en"
            ? ` ([Source](${args.makerworld_url}))`
            : `（[MakerWorld](${args.makerworld_url})）`
          : "";
        const slotDesc = chosenTray
          ? `${chosenTray.label} ${chosenTray.color_name} ${chosenTray.brand_variant}`
          : chosenSlot === 254
            ? LANG === "en" ? `External Spool ${matInfo.family}` : `外掛料架 ${matInfo.family}`
            : `A${(chosenSlot ?? 0) + 1} ${matInfo.family}`;

        let cardLines;
        if (LANG === "en") {
          cardLines = [
            `[${printerSpec.displayName} Print Confirmation] ${displayName}${mwSuffix}`,
            `- Nozzle / Leveling: ${nozzle}mm | Bed Leveling: ${bedLeveling ? "On" : "Off"}`,
            `- Filament / Temp: ${slotDesc} (Nozzle ${built.summary.nozzleTemp}°C · Bed ${built.summary.bedTemp}°C)`,
            `- Settings: ${built.summary.layerHeight}mm layer | ${built.summary.wallLoops} walls | ${built.summary.infillDensity} ${built.summary.infillPattern} | Support: ${built.summary.support === "無" ? "None" : built.summary.support} | Brim: ${built.summary.brim === "無" ? "None" : built.summary.brim}`,
            `- Estimate: ${timeStr} | ${gramsStr}`,
            ``,
            `👉 Confirm the build plate is clear, then reply "Print" to start.`,
          ];
        } else {
          const patLabel = INFILL_LABELS_ZH[built.summary.infillPattern] || built.summary.infillPattern;
          cardLines = [
            `【${printerSpec.displayName} 列印確認】${displayName}${mwSuffix}`,
            `- 噴嘴／調平：${nozzle}mm ｜ 熱床調平：${bedLeveling ? "開" : "關"}`,
            `- 耗材／溫度：${slotDesc}（噴頭 ${built.summary.nozzleTemp}°C・熱床 ${built.summary.bedTemp}°C）`,
            `- 參數：${built.summary.layerHeight}mm 層高｜${built.summary.wallLoops}牆｜${built.summary.infillDensity} ${patLabel}｜支撐：${built.summary.support}｜Brim：${built.summary.brim}`,
            `- 預估：${timeStr} ｜ ${gramsStr}`,
            ``,
            `👉 請確認熱床已清空；沒問題請回「印」或「開印」。`,
          ];
        }
        for (const w of built.warnings) {
          cardLines.push(`⚠️ ${w}`);
        }

        const jobRecord = {
          job_id: jobId,
          created_at: new Date().toISOString(),
          printer_model: printerSpec.id,
          display_name: displayName,
          sliced_3mf_path: sliced.path,
          plate_index: plateIndex,
          nozzle_diameter: Number(nozzle),
          ams_slots: amsSlotsForJob,
          use_ams: chosenSlot !== 254,
          bed_leveling: bedLeveling,
          slot_desc: slotDesc,
          time_str: timeStr,
          grams: Number(grams.toFixed(2)),
        };
        await fs.promises.writeFile(path.join(JOBS_DIR, `${jobId}.json`), JSON.stringify(jobRecord, null, 2), "utf8");

        const responsePayload = {
          ok: true,
          job_id: jobId,
          printer_model: printerSpec.id,
          sliced_3mf_path: sliced.path,
          preview_images: previews.hostPaths,
          ...(previews.aliasPaths.length ? { vm_preview_images: previews.aliasPaths } : {}),
          verified: {
            materials: inspection.materials,
            max_nozzle_temp_c: inspection.maxNozzleTemperature,
            print_nozzle_temp_c: built.summary.nozzleTemp,
            bed_temp_c: built.summary.bedTemp,
            max_volumetric_speed: built.summary.maxVolumetricSpeed,
            grams: Number(grams.toFixed(2)),
            seconds,
            duration_text: timeStr,
          },
          applied_modules: {
            preset: built.summary.preset,
            modifiers: built.summary.modifiers,
            ams_slots: amsSlotsForJob,
          },
          confirmation_card: cardLines.join("\n"),
        };

        return { content: [{ type: "text", text: JSON.stringify(responsePayload, null, 2) }] };
      } finally {
        cleanup();
        fs.promises.unlink(tmpProcPath).catch(() => {});
        fs.promises.unlink(tmpFil1Path).catch(() => {});
        fs.promises.unlink(tmpFil2Path).catch(() => {});
      }
    }

    // ========================================================================
    // TOOL 4: start_print
    // ========================================================================
    if (actionKind === "start_print") {
      let job = null;
      if (args.job_id) {
        const jp = path.join(JOBS_DIR, `${String(args.job_id).trim()}.json`);
        if (!fs.existsSync(jp)) {
          throw new Error(`Slice job "${args.job_id}" not found. Run slice_modular first.`);
        }
        job = JSON.parse(await fs.promises.readFile(jp, "utf8"));
      }

      const slicedPath = args.sliced_3mf_path ? resolveHostModelPath(args.sliced_3mf_path) : job?.sliced_3mf_path;
      if (!slicedPath || !fs.existsSync(slicedPath)) {
        throw new Error("Sliced .3mf file missing or expired. Run slice_modular first.");
      }

      const sinceCancelMs = Date.now() - lastCancelAt;
      if (lastCancelAt > 0 && sinceCancelMs < 31000) {
        await new Promise((r) => setTimeout(r, 31000 - sinceCancelMs));
      }

      const host = await resolveEffectiveHost();
      const preSt = await bambu.getStatus(host, BAMBU_SERIAL, BAMBU_TOKEN);
      if (preSt.connected && (preSt.status === "RUNNING" || preSt.status === "PREPARE" || preSt.status === "SLICING")) {
        throw new Error(`Safety Block: Printer is currently busy (${preSt.print?.filename || preSt.status}).`);
      }

      const printerSpec = resolvePrinterSpec(job?.printer_model || DEFAULT_MODEL || preSt.model, BAMBU_SERIAL);
      const amsSlots = Array.isArray(args.ams_slots) ? args.ams_slots.map(Number) : job?.ams_slots ?? [0];
      const useAMS = amsSlots.length > 0 && amsSlots[0] !== 254;
      const bedLeveling = args.bed_leveling !== undefined ? Boolean(args.bed_leveling) : Boolean(job?.bed_leveling ?? false);
      const plateIndex = args.plate_index !== undefined ? Number(args.plate_index) : Number(job?.plate_index ?? 0);
      const nozzleDiam = job?.nozzle_diameter ?? Number(preSt.raw?.nozzle_diameter || 0.4);
      const projectName = (job?.display_name || path.basename(slicedPath, ".3mf")).replace(/[^\w\u4e00-\u9fff -]/g, "_").slice(0, 48);

      const printRes = await bambu.print3mf(host, BAMBU_SERIAL, BAMBU_TOKEN, {
        projectName,
        filePath: slicedPath,
        bambuModel: printerSpec.id,
        nozzleDiameters: [nozzleDiam],
        plateIndex,
        useAMS,
        amsSlots: useAMS ? amsSlots : undefined,
        bedType: "textured_plate",
        bedLeveling,
        flowCalibration: Boolean(args.flow_calibration ?? false),
      });

      let verifiedRunning = printRes?.dispatch === "started" || printRes?.status === "started";
      let finalState = preSt.status;
      for (let i = 0; i < 4 && !verifiedRunning; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const check = await bambu.getStatus(host, BAMBU_SERIAL, BAMBU_TOKEN);
        finalState = check.status;
        if (["RUNNING", "PREPARE", "SLICING"].includes(check.status)) {
          verifiedRunning = true;
          break;
        }
      }
      cachedStatusAt = 0;

      const oneLine =
        LANG === "en"
          ? `✅ Print started: ${job?.display_name || path.basename(slicedPath)} (${job?.slot_desc || `Slot ${amsSlots.join(",")}`} · ${job?.time_str || "Starting"}).`
          : `✅ 已開始列印：${job?.display_name || path.basename(slicedPath)}（${job?.slot_desc || `槽位 ${amsSlots.join(",")}`}・${job?.time_str || "準備中"}）。`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: verifiedRunning,
                printer_state: finalState,
                reply_line: oneLine,
                detail: printRes,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
