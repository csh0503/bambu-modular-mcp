import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Universal 4-Layer Modular Slicing Engine for Bambu Lab Printers
 *
 * TRANSPARENCY & ATTRIBUTION NOTE:
 * The built-in scene presets and stackable modifiers below are synthesized from publicly
 * shared 3D printing community resources, slicer documentation, and online discussions
 * (including Bambu Lab Wiki, OrcaSlicer documentation, Ellis' Print Tuning Guide,
 * CNC Kitchen extrusion studies, and community threads) — NOT individually bench-tested
 * across every printer model, nozzle size, and filament brand by the author.
 *
 * Community contributions, real-world corrections, and custom JSON recipes under
 * `community-presets/` are warmly welcomed!
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PRINTER_CATALOG = {
  p2s: {
    id: "p2s",
    displayName: "P2S",
    machinePrefix: "Bambu Lab P2S",
    processTags: ["P2S", "X1C"],
    filamentTags: ["P2S", "X1C"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 256,
  },
  x1c: {
    id: "x1c",
    displayName: "X1C",
    machinePrefix: "Bambu Lab X1 Carbon",
    processTags: ["X1C"],
    filamentTags: ["X1C", "X1"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 256,
  },
  x1: {
    id: "x1",
    displayName: "X1",
    machinePrefix: "Bambu Lab X1",
    processTags: ["X1C", "X1"],
    filamentTags: ["X1", "X1C"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 256,
  },
  x1e: {
    id: "x1e",
    displayName: "X1E",
    machinePrefix: "Bambu Lab X1E",
    processTags: ["X1E", "X1C"],
    filamentTags: ["X1E", "X1C"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 256,
  },
  p1s: {
    id: "p1s",
    displayName: "P1S",
    machinePrefix: "Bambu Lab P1S",
    processTags: ["X1C", "P1P"],
    filamentTags: ["P1S", "X1C", "P1P"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 256,
  },
  p1p: {
    id: "p1p",
    displayName: "P1P",
    machinePrefix: "Bambu Lab P1P",
    processTags: ["P1P", "X1C"],
    filamentTags: ["P1P", "X1C"],
    enclosed: false,
    bedslinger: false,
    bedSizeMm: 256,
  },
  a1: {
    id: "a1",
    displayName: "A1",
    machinePrefix: "Bambu Lab A1",
    processTags: ["A1"],
    filamentTags: ["A1"],
    enclosed: false,
    bedslinger: true,
    bedSizeMm: 256,
  },
  a1m: {
    id: "a1m",
    displayName: "A1 mini",
    machinePrefix: "Bambu Lab A1 mini",
    processTags: ["A1M", "A1"],
    filamentTags: ["A1M", "A1"],
    enclosed: false,
    bedslinger: true,
    bedSizeMm: 180,
  },
  h2d: {
    id: "h2d",
    displayName: "H2D",
    machinePrefix: "Bambu Lab H2D",
    processTags: ["H2D", "H2S"],
    filamentTags: ["H2D", "H2S"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 350,
  },
  h2dp: {
    id: "h2dp",
    displayName: "H2D Pro",
    machinePrefix: "Bambu Lab H2D Pro",
    processTags: ["H2DP", "H2D"],
    filamentTags: ["H2DP", "H2D"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 350,
  },
  h2s: {
    id: "h2s",
    displayName: "H2S",
    machinePrefix: "Bambu Lab H2S",
    processTags: ["H2S", "H2D"],
    filamentTags: ["H2S", "H2D"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 350,
  },
  h2c: {
    id: "h2c",
    displayName: "H2C",
    machinePrefix: "Bambu Lab H2C",
    processTags: ["H2C", "H2D"],
    filamentTags: ["H2C", "H2D"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 350,
  },
  x2d: {
    id: "x2d",
    displayName: "X2D",
    machinePrefix: "Bambu Lab X2D",
    processTags: ["X2D", "P2S"],
    filamentTags: ["X2D", "P2S"],
    enclosed: true,
    bedslinger: false,
    bedSizeMm: 256,
  },
};

const SERIAL_PREFIX_TO_MODEL = {
  "22E": "p2s",
  "00M": "x1c",
  "00W": "x1",
  "03W": "x1e",
  "01P": "p1s",
  "01S": "p1p",
  "039": "a1",
  "030": "a1m",
  "094": "h2d",
  "239": "h2dp",
  "093": "h2s",
  "31B": "h2c",
  "20P": "x2d",
};

export function resolvePrinterSpec(modelInput, serialInput = "") {
  const cleaned = String(modelInput || "")
    .trim()
    .toLowerCase()
    .replace(/^bambu\s*lab\s*/i, "")
    .replace(/[\s_-]+/g, "");

  const aliases = {
    p2s: "p2s",
    x1c: "x1c",
    x1carbon: "x1c",
    x1: "x1",
    x1e: "x1e",
    p1s: "p1s",
    p1p: "p1p",
    a1: "a1",
    a1m: "a1m",
    a1mini: "a1m",
    h2d: "h2d",
    h2dpro: "h2dp",
    h2dp: "h2dp",
    h2s: "h2s",
    h2c: "h2c",
    x2d: "x2d",
  };
  if (cleaned && aliases[cleaned]) {
    return PRINTER_CATALOG[aliases[cleaned]];
  }
  const snPrefix = String(serialInput || "").trim().toUpperCase().slice(0, 3);
  if (snPrefix && SERIAL_PREFIX_TO_MODEL[snPrefix]) {
    return PRINTER_CATALOG[SERIAL_PREFIX_TO_MODEL[snPrefix]];
  }
  return PRINTER_CATALOG.p2s;
}

export const BUILTIN_PRESET_NAMES = [
  "structural",    // Everyday structural part (3 walls, gyroid, inner-outer-inner, slow Layer 1)
  "heavy_duty",    // High-load bracket / screw mount (5 walls, 30% gyroid, wider lines, +5°C)
  "fine_smooth",   // Smooth visual finish (finer layer, constant Z outer wall speed, infill combination)
  "safe_fast",     // Safe high-speed draft within hotend volumetric limit (crosshatch infill)
  "miniature",     // 28mm miniatures / <3mm text / stamps (Arachne, slow outer wall, slim tree support)
  "precision_fit", // Snap-fits / bearing bores / screw holes (precise outer wall + XY hole compensation)
  "articulated",   // Print-in-place articulated models / hinges (zero brim, elephant-foot guard)
  "watertight",    // Watertight planters / cups (5 walls, 6 shells, 1.02 flow ratio, +5°C)
  "vase",          // Seamless spiral vase mode with thickened single wall
  "author_3mf",    // Keep original .3mf author geometry settings while applying safe material temps
];

export const BUILTIN_MODIFIER_NAMES = [
  "scarf_seam",          // Curved surface seam hiding (conditional scarf on PLA; back+gap on PETG)
  "aligned_seam",        // Sharp corner seam hiding for boxy parts
  "ironing",             // Smooth top ironing (30mm/s + 10% low-flow rectilinear, zero edge burrs)
  "fuzzy_skin",          // External-only Perlin micro-matte texture (protects internal holes)
  "overhang_pro",        // Steep overhang & bridge boost (inner-outer order + 0.90 bridge flow)
  "support_tree_easy",   // Easy-peel 5-layer rectilinear_interlaced tree supports (0.16mm@0.4 / ~0.9x@0.6)
  "support_normal_snug", // Snug normal supports for flat overhangs
  "support_bimat_zero",  // AMS zero-Z-gap multi-material support interface (auto PLA⇄PETG)
  "counterbore_bridge",  // 1-layer sacrificial bridge for downward counterbore holes
  "brim_anti_warp",      // 8mm outer brim + height slowdown for tall/warping parts
  "brim_ears",           // Corner mouse-ear brim
  "by_object",           // Print-by-object sequence to eliminate stringing across parts
  "silk_mirror",         // Constant 45mm/s outer wall speed for uniform Silk PLA sheen
  "clear_glass",         // Clear PETG solid 100% aligned rectilinear slow bubble-free recipe
];

/**
 * Loads community-contributed JSON presets & modifiers from `community-presets/`
 * (and optional `BAMBU_CUSTOM_PRESETS_DIR`).
 */
export function loadCommunityExtensions(extraRoot = process.env.BAMBU_CUSTOM_PRESETS_DIR) {
  const roots = [path.join(__dirname, "community-presets"), extraRoot].filter(Boolean);
  const customPresets = new Map();
  const customModifiers = new Map();

  const scanSubdir = (sub, targetMap) => {
    for (const r of roots) {
      const dir = path.join(r, sub);
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith(".json") || entry.startsWith("_")) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dir, entry), "utf8"));
          const id = String(data.id || path.basename(entry, ".json")).trim();
          if (id) targetMap.set(id, data);
        } catch {
          // Skip malformed user JSON without crashing server startup
        }
      }
    }
  };

  scanSubdir("presets", customPresets);
  scanSubdir("modifiers", customModifiers);
  return { customPresets, customModifiers };
}

export const COMMUNITY_EXTENSIONS = loadCommunityExtensions();
export const PRESET_NAMES = [
  ...new Set([...BUILTIN_PRESET_NAMES, ...COMMUNITY_EXTENSIONS.customPresets.keys()]),
];
export const MODIFIER_NAMES = [
  ...new Set([...BUILTIN_MODIFIER_NAMES, ...COMMUNITY_EXTENSIONS.customModifiers.keys()]),
];

const ABRASIVE_OR_CLOG_PATTERNS = /\b(cf|gf|carbon|glass|wood|glow|marble|sparkle|metal|glitter)\b/i;

export function normalizeNozzle(raw) {
  const n = Number(raw || 0.4);
  if (Math.abs(n - 0.2) < 0.05) return "0.2";
  if (Math.abs(n - 0.4) < 0.05) return "0.4";
  if (Math.abs(n - 0.6) < 0.05) return "0.6";
  if (Math.abs(n - 0.8) < 0.05) return "0.8";
  return "0.4";
}

export function detectSystemBblDir(explicitRoot) {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    explicitRoot ? path.join(explicitRoot, "BBL") : null,
    explicitRoot,
    process.env.BAMBU_PROFILES_ROOT ? path.join(process.env.BAMBU_PROFILES_ROOT, "BBL") : null,
    process.env.BAMBU_PROFILES_ROOT,
    process.env.APPDATA ? path.join(process.env.APPDATA, "BambuStudio", "system", "BBL") : null,
    home ? path.join(home, "Library", "Application Support", "BambuStudio", "system", "BBL") : null,
    home ? path.join(home, ".config", "BambuStudio", "system", "BBL") : null,
    "C:\\Program Files\\Bambu Studio\\resources\\profiles\\BBL",
    "D:\\Bambu Studio\\resources\\profiles\\BBL",
    "/Applications/BambuStudio.app/Contents/Resources/profiles/BBL",
    "/usr/share/BambuStudio/resources/profiles/BBL",
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "process")) && fs.existsSync(path.join(c, "filament"))) {
      return c;
    }
  }
  throw new Error(
    `Cannot locate Bambu Studio BBL system profiles directory. Set BAMBU_PROFILES_ROOT to the folder containing BBL/process & BBL/filament.`
  );
}

export function classifyMaterial(tray = {}, fallbackMaterial = "PLA") {
  const rawType = String(tray.tray_type || fallbackMaterial || "PLA").trim().toUpperCase();
  const sub = String(tray.tray_sub_brands || "").trim();
  const infoIdx = String(tray.tray_info_idx || "").trim().toUpperCase();
  const combined = `${rawType} ${sub} ${infoIdx}`;

  let family = "PLA";
  if (rawType.includes("PETG") || infoIdx.startsWith("GFG")) family = "PETG";
  else if (rawType.includes("ASA")) family = "ASA";
  else if (rawType.includes("ABS")) family = "ABS";
  else if (rawType.includes("TPU") || infoIdx.startsWith("GFU")) family = "TPU";
  else if (rawType.includes("PC")) family = "PC";
  else if (rawType.includes("PA") || rawType.includes("NYLON")) family = "PA";

  const isCF = /\b(cf|gf)\b/i.test(combined);
  const isSilk = /silk/i.test(combined);
  const isMatte = /matte/i.test(combined);
  const isHF = /\bhf\b/i.test(combined);
  const isTranslucent = /transluc/i.test(combined);
  const isClogRiskOn02 = ABRASIVE_OR_CLOG_PATTERNS.test(combined) || (family === "TPU" && !/ams/i.test(combined));

  return { family, rawType, sub, infoIdx, isCF, isSilk, isMatte, isHF, isTranslucent, isClogRiskOn02 };
}

export function resolveSystemFilamentBase(bblDir, printerSpec, matInfo, nozzle) {
  const filDir = path.join(bblDir, "filament");
  const candidates = [];

  const pushVariants = (prefix) => {
    for (const tag of printerSpec.filamentTags) {
      candidates.push(`${prefix} @BBL ${tag} ${nozzle} nozzle`);
      candidates.push(`${prefix} @BBL ${tag}`);
    }
    candidates.push(`${prefix} @BBL X1C ${nozzle} nozzle`);
    candidates.push(`${prefix} @BBL X1C`);
  };

  if (matInfo.sub) {
    const cleanSub = matInfo.sub.startsWith("Bambu ") ? matInfo.sub : `Bambu ${matInfo.sub}`;
    pushVariants(cleanSub);
  }

  if (matInfo.family === "PLA") {
    if (matInfo.isCF) pushVariants("Bambu PLA-CF");
    else if (matInfo.isSilk) pushVariants("Bambu PLA Silk");
    else if (matInfo.isMatte) pushVariants("Bambu PLA Matte");
    pushVariants("Bambu PLA Basic");
    pushVariants("Generic PLA");
  } else if (matInfo.family === "PETG") {
    if (matInfo.isCF) pushVariants("Bambu PETG-CF");
    else if (matInfo.isHF) pushVariants("Bambu PETG HF");
    else if (matInfo.isTranslucent) pushVariants("Bambu PETG Translucent");
    pushVariants("Bambu PETG Basic");
    pushVariants("Generic PETG");
  } else if (matInfo.family === "ASA") {
    pushVariants("Bambu ASA");
    pushVariants("Generic ASA");
  } else if (matInfo.family === "ABS") {
    pushVariants("Bambu ABS");
    pushVariants("Generic ABS");
  } else if (matInfo.family === "TPU") {
    pushVariants("Bambu TPU 95A HF");
    pushVariants("Generic TPU");
  } else if (matInfo.family === "PC") {
    pushVariants("Bambu PC");
    pushVariants("Generic PC");
  } else if (matInfo.family === "PA") {
    pushVariants("Bambu PAHT-CF");
    pushVariants("Generic PA-CF");
  }

  for (const name of candidates) {
    const full = path.join(filDir, `${name}.json`);
    if (fs.existsSync(full)) {
      return { baseName: name, fullPath: full };
    }
  }
  throw new Error(
    `No matching system filament profile found in ${filDir} for ${printerSpec.displayName} / ${matInfo.family} (${nozzle}mm)`
  );
}

export function resolveSystemProcessBase(bblDir, printerSpec, nozzle, targetLayer) {
  const procDir = path.join(bblDir, "process");
  const candidates = [];

  for (const tag of printerSpec.processTags) {
    if (nozzle === "0.2") {
      if (targetLayer <= 0.06) {
        candidates.push(`0.06mm High Quality @BBL ${tag} 0.2 nozzle`, `0.06mm Fine @BBL ${tag} 0.2 nozzle`);
      }
      if (targetLayer <= 0.08) {
        candidates.push(`0.08mm High Quality @BBL ${tag} 0.2 nozzle`, `0.08mm Extra Fine @BBL ${tag} 0.2 nozzle`);
      }
      if (targetLayer <= 0.10) {
        candidates.push(`0.10mm Standard @BBL ${tag} 0.2 nozzle`);
      }
      candidates.push(
        `0.12mm Balanced Quality @BBL ${tag} 0.2 nozzle`,
        `0.10mm Standard @BBL ${tag} 0.2 nozzle`,
        `0.12mm Standard @BBL ${tag} 0.2 nozzle`
      );
    } else if (nozzle === "0.4") {
      if (targetLayer <= 0.12) {
        candidates.push(`0.12mm High Quality @BBL ${tag}`, `0.12mm Fine @BBL ${tag}`);
      }
      if (targetLayer <= 0.16) {
        candidates.push(
          `0.16mm High Quality @BBL ${tag}`,
          `0.16mm Optimal @BBL ${tag}`,
          `0.16mm Standard @BBL ${tag}`
        );
      }
      if (targetLayer >= 0.24) {
        candidates.push(`0.24mm Standard @BBL ${tag}`, `0.24mm Draft @BBL ${tag}`);
      }
      candidates.push(`0.20mm Standard @BBL ${tag}`, `0.20mm High Quality @BBL ${tag}`);
    } else if (nozzle === "0.6") {
      if (targetLayer <= 0.18) {
        candidates.push(`0.18mm Balanced Quality @BBL ${tag} 0.6 nozzle`, `0.18mm Fine @BBL ${tag} 0.6 nozzle`);
      }
      if (targetLayer <= 0.24) {
        candidates.push(
          `0.24mm Balanced Quality @BBL ${tag} 0.6 nozzle`,
          `0.24mm Optimal @BBL ${tag} 0.6 nozzle`,
          `0.24mm Standard @BBL ${tag} 0.6 nozzle`
        );
      }
      candidates.push(
        `0.30mm Standard @BBL ${tag} 0.6 nozzle`,
        `0.24mm Balanced Quality @BBL ${tag} 0.6 nozzle`,
        `0.24mm Standard @BBL ${tag} 0.6 nozzle`
      );
    } else {
      // 0.8mm nozzle
      candidates.push(
        `0.40mm Standard @BBL ${tag} 0.8 nozzle`,
        `0.32mm Optimal @BBL ${tag} 0.8 nozzle`,
        `0.32mm Balanced Quality @BBL ${tag} 0.8 nozzle`
      );
    }
  }

  for (const name of candidates) {
    if (fs.existsSync(path.join(procDir, `${name}.json`))) return name;
  }

  // Fallback scan by tag & nozzle suffix
  const files = fs.readdirSync(procDir).filter((f) => f.endsWith(".json"));
  for (const tag of printerSpec.processTags) {
    const suffix = nozzle === "0.4" ? `@BBL ${tag}.json` : `@BBL ${tag} ${nozzle} nozzle.json`;
    const hit = files.find((f) => f.endsWith(suffix));
    if (hit) return hit.replace(/\.json$/, "");
  }

  throw new Error(
    `No matching system process profile found in ${procDir} for ${printerSpec.displayName} (${nozzle}mm)`
  );
}

function mergeInheritedJson(dir, baseName, visited = new Set()) {
  if (!baseName || visited.has(baseName)) return {};
  visited.add(baseName);
  const full = path.join(dir, `${baseName}.json`);
  if (!fs.existsSync(full)) return {};
  const cur = JSON.parse(fs.readFileSync(full, "utf8"));
  const parent = cur.inherits ? mergeInheritedJson(dir, cur.inherits, visited) : {};
  return { ...parent, ...cur };
}

/**
 * Formats a speed/accel/boolean process setting to match the exact type & vector length
 * expected by the target Bambu Studio printer generation (scalar vs 1, 2, 3, or 7-element array).
 */
function formatProcField(mergedBase, key, stdVal, hfVal = stdVal) {
  const s = String(stdVal);
  const h = String(hfVal);
  const ref = mergedBase[key];
  if (Array.isArray(ref)) {
    const len = Math.max(1, ref.length);
    if (len === 1) return [s];
    return [s, ...Array(len - 1).fill(h)];
  }
  return s;
}

function applyCommunityPatch(proc, fil, extObj, nozzle, matFamily) {
  if (!extObj || typeof extObj !== "object") return { tempDelta: 0, mvsCap: null };
  const mergeInto = (src) => {
    if (!src) return;
    if (src.process && typeof src.process === "object") Object.assign(proc, src.process);
    if (src.filament && typeof src.filament === "object") Object.assign(fil, src.filament);
  };
  mergeInto(extObj);
  if (extObj.by_nozzle?.[nozzle]) mergeInto(extObj.by_nozzle[nozzle]);
  if (extObj.by_material?.[matFamily]) mergeInto(extObj.by_material[matFamily]);
  return {
    tempDelta: Number(extObj.nozzle_temp_delta || 0),
    mvsCap: extObj.max_volumetric_speed !== undefined ? Number(extObj.max_volumetric_speed) : null,
  };
}

export function buildModularProfiles({
  bblDir,
  printerModel = "p2s",
  printerSerial = "",
  nozzle,
  flowMode = "standard",
  matInfo,
  preset = "structural",
  modifiers = [],
  overrides = {},
  authorSettings = null,
}) {
  const printerSpec = resolvePrinterSpec(printerModel, printerSerial);
  const ext = loadCommunityExtensions();
  const allPresets = new Set([...BUILTIN_PRESET_NAMES, ...ext.customPresets.keys()]);
  const allModifiers = new Set([...BUILTIN_MODIFIER_NAMES, ...ext.customModifiers.keys()]);

  if (!allPresets.has(preset)) {
    throw new Error(`Unknown preset "${preset}". Available: ${[...allPresets].join(", ")}`);
  }
  for (const m of modifiers) {
    if (!allModifiers.has(m)) {
      throw new Error(`Unknown modifier "${m}". Available: ${[...allModifiers].join(", ")}`);
    }
  }

  // Safety Guard #1: 0.2mm anti-clog hard block
  if (nozzle === "0.2" && matInfo.isClogRiskOn02) {
    throw new Error(
      `Safety Block: 0.2mm nozzle cannot print fiber-filled, particle, or soft TPU filaments (${matInfo.sub || matInfo.family}) due to severe clog risk. Switch to a >=0.4mm/0.6mm nozzle or clean PLA/PETG.`
    );
  }

  const isHFNozzle = flowMode === "high_flow";
  const warnings = [];
  const modSet = new Set(modifiers);

  // Open-frame printer warning for high-temp warp-prone materials
  if (!printerSpec.enclosed && ["ABS", "ASA", "PC", "PA"].includes(matInfo.family)) {
    warnings.push(
      `${printerSpec.displayName} 為開放式機身，列印 ${matInfo.family} 極易因冷風收縮翹邊或裂層，建議改用 PLA/PETG 或加裝防風罩並開啟 brim_anti_warp。`
    );
  }

  // =========================================================================
  // LAYER 1: Hardware + Material Safe Filament Profile
  // =========================================================================
  const { baseName: filBaseName } = resolveSystemFilamentBase(bblDir, printerSpec, matInfo, nozzle);
  const fil = {
    type: "filament",
    name: `bambu_mod_fil_${printerSpec.id}_${matInfo.family.toLowerCase()}_${nozzle}`,
    from: "User",
    inherits: filBaseName,
    first_x_layer_fan_speed: ["0"], // Prevents unwanted Layer-1 part-cooling fan on 0.6mm PLA profiles
  };

  let nozzleTemp = 225;
  let bedTemp = 55;
  let mvs = 20;

  if (matInfo.family === "PLA") {
    nozzleTemp = matInfo.isSilk || matInfo.isCF ? 230 : nozzle === "0.6" || nozzle === "0.8" ? 225 : 220;
    bedTemp = printerSpec.id === "a1m" || printerSpec.id === "a1" ? 60 : 55;
    mvs = matInfo.isSilk
      ? nozzle === "0.2" ? 1.8 : nozzle === "0.4" ? 11 : 12
      : matInfo.isCF
        ? nozzle === "0.4" ? 15 : 18
        : nozzle === "0.2" ? 2 : nozzle === "0.4" ? 20 : isHFNozzle ? 35 : 23;
    fil.close_fan_the_first_x_layers = ["1"];
    fil.slow_down_layer_time = ["10"];
    fil.slow_down_min_speed = ["10"];
    if (matInfo.isSilk) fil.no_slow_down_for_cooling_on_outwalls = ["1"];
  } else if (matInfo.family === "PETG") {
    nozzleTemp = matInfo.isCF ? 255 : matInfo.isHF ? 245 : 250;
    bedTemp = 70;
    mvs = matInfo.isCF
      ? 11.5
      : matInfo.isHF
        ? nozzle === "0.2" ? 1 : nozzle === "0.4" ? 18 : isHFNozzle ? 29 : 20.5
        : matInfo.isTranslucent
          ? nozzle === "0.2" ? 1 : nozzle === "0.4" ? 6 : 12
          : nozzle === "0.2" ? 1 : nozzle === "0.4" ? 13 : isHFNozzle ? 22 : 15.5;
    fil.nozzle_temperature_initial_layer = [String(Math.max(235, nozzleTemp - 5))];
    fil.close_fan_the_first_x_layers = ["3"];
    fil.additional_cooling_fan_speed = ["0"];
    fil.filament_z_hop = ["0.2"];
    if ((nozzle === "0.6" || nozzle === "0.8") && !matInfo.isHF) {
      fil.overhang_fan_speed = ["45"];
      fil.overhang_fan_threshold = ["25%"];
    }
  } else if (matInfo.family === "ABS" || matInfo.family === "ASA") {
    nozzleTemp = 270;
    bedTemp = printerSpec.id === "a1m" ? 80 : 100;
    mvs = nozzle === "0.2" ? 2 : nozzle === "0.4" ? 16 : isHFNozzle ? 32 : 24;
    fil.close_fan_the_first_x_layers = ["3"];
    fil.additional_cooling_fan_speed = ["0"];
  } else if (matInfo.family === "TPU") {
    nozzleTemp = 230;
    bedTemp = 35;
    mvs = matInfo.isHF ? 11 : 4.5;
    fil.filament_z_hop = ["0"];
  } else if (matInfo.family === "PC") {
    nozzleTemp = 280;
    bedTemp = 105;
    mvs = nozzle === "0.4" ? 16 : 23;
    fil.additional_cooling_fan_speed = ["0"];
  } else if (matInfo.family === "PA") {
    nozzleTemp = 290;
    bedTemp = 100;
    mvs = 8;
    fil.additional_cooling_fan_speed = ["0"];
  }

  // =========================================================================
  // LAYER 2: Primary Scene Preset
  // =========================================================================
  let defaultLayer =
    nozzle === "0.2" ? 0.10 : nozzle === "0.4" ? 0.20 : nozzle === "0.6" ? 0.30 : 0.40;
  if (preset === "fine_smooth") {
    defaultLayer = nozzle === "0.2" ? 0.08 : nozzle === "0.4" ? 0.16 : nozzle === "0.6" ? 0.18 : 0.28;
  } else if (preset === "miniature") {
    defaultLayer = nozzle === "0.2" ? 0.06 : nozzle === "0.4" ? 0.10 : 0.18;
  } else if (preset === "safe_fast") {
    defaultLayer = nozzle === "0.2" ? 0.12 : nozzle === "0.4" ? 0.24 : nozzle === "0.6" ? 0.30 : 0.44;
  } else if (preset === "vase") {
    defaultLayer = nozzle === "0.2" ? 0.10 : nozzle === "0.4" ? 0.20 : 0.24;
  } else if (preset === "heavy_duty") {
    defaultLayer = nozzle === "0.2" ? 0.10 : nozzle === "0.4" ? 0.20 : nozzle === "0.6" ? 0.28 : 0.40;
  } else if (preset === "author_3mf" && authorSettings?.layer_height) {
    defaultLayer = Math.min(Number(authorSettings.layer_height), Number(nozzle) * 0.72);
  }

  const finalLayer = overrides.layer_height !== undefined ? Number(overrides.layer_height) : defaultLayer;
  if (finalLayer > Number(nozzle) * 0.78) {
    throw new Error(
      `Layer height ${finalLayer}mm exceeds safe maximum (${(Number(nozzle) * 0.75).toFixed(2)}mm) for a ${nozzle}mm nozzle.`
    );
  }

  const procBaseName = resolveSystemProcessBase(bblDir, printerSpec, nozzle, finalLayer);
  const mergedProcBase = mergeInheritedJson(path.join(bblDir, "process"), procBaseName);
  const pVal = (key, stdVal, hfVal = stdVal) => formatProcField(mergedProcBase, key, stdVal, hfVal);

  const initWidth =
    nozzle === "0.2" ? "0.22" : nozzle === "0.4" ? "0.50" : nozzle === "0.6" ? "0.65" : "0.85";

  const proc = {
    type: "process",
    name: `bambu_mod_proc_${printerSpec.id}_${preset}_${nozzle}`,
    from: "User",
    inherits: procBaseName,
    compatible_printers: [`${printerSpec.machinePrefix} ${nozzle} nozzle`],
    layer_height: String(finalLayer),
    initial_layer_print_height:
      nozzle === "0.2" ? "0.10" : nozzle === "0.4" ? "0.20" : nozzle === "0.6" ? "0.30" : "0.40",
    initial_layer_line_width: initWidth,
    initial_layer_speed: pVal("initial_layer_speed", 25),
    initial_layer_infill_speed: pVal("initial_layer_infill_speed", 45),
    initial_layer_acceleration: pVal("initial_layer_acceleration", 500),
    enable_arc_fitting: "1",
    reduce_crossing_wall: "1",
    elefant_foot_compensation: "0.18",
    wall_loops: "3",
    wall_infill_order: "inner-outer-inner wall/infill",
    sparse_infill_pattern: "gyroid",
    sparse_infill_density: "12%",
    enable_support: "0",
    brim_type: "no_brim",
    brim_width: "0",
    outer_wall_speed: pVal("outer_wall_speed", nozzle === "0.2" ? 50 : 125, 140),
    inner_wall_speed: pVal("inner_wall_speed", nozzle === "0.2" ? 70 : 160, 200),
    sparse_infill_speed: pVal("sparse_infill_speed", nozzle === "0.2" ? 80 : 180, 220),
    outer_wall_acceleration: pVal(
      "outer_wall_acceleration",
      nozzle === "0.2" ? 1800 : printerSpec.bedslinger ? 2500 : 3000,
      3500
    ),
  };

  if (printerSpec.bedslinger) {
    proc.enable_height_slowdown = pVal("enable_height_slowdown", 1);
  }

  switch (preset) {
    case "structural": {
      proc.wall_loops = "3";
      proc.sparse_infill_density = nozzle === "0.6" || nozzle === "0.8" ? "10%" : "15%";
      proc.sparse_infill_pattern = "gyroid";
      proc.top_shell_layers = nozzle === "0.2" ? "6" : nozzle === "0.4" ? "5" : "4";
      proc.bottom_shell_layers = nozzle === "0.2" ? "5" : nozzle === "0.4" ? "4" : "3";
      break;
    }
    case "heavy_duty": {
      proc.wall_loops = "5";
      proc.sparse_infill_density = "30%";
      proc.sparse_infill_pattern = "gyroid";
      proc.top_shell_layers = "5";
      proc.bottom_shell_layers = "5";
      proc.counterbore_hole_bridging = "sacrificiallayer";
      if (nozzle === "0.6") {
        proc.inner_wall_line_width = "0.75";
        proc.outer_wall_line_width = "0.68";
      } else if (nozzle === "0.4") {
        proc.inner_wall_line_width = "0.52";
        proc.outer_wall_line_width = "0.48";
      }
      nozzleTemp += 5;
      break;
    }
    case "fine_smooth": {
      proc.wall_loops = "3";
      proc.sparse_infill_density = "15%";
      proc.sparse_infill_pattern = "crosshatch";
      proc.z_direction_outwall_speed_continuous = "1";
      proc.infill_combination = "1";
      proc.outer_wall_speed = pVal("outer_wall_speed", nozzle === "0.2" ? 35 : 120);
      proc.outer_wall_acceleration = pVal("outer_wall_acceleration", nozzle === "0.2" ? 1500 : 2500);
      fil.no_slow_down_for_cooling_on_outwalls = ["1"];
      fil.cooling_slowdown_logic = ["consistent_surface"];
      break;
    }
    case "safe_fast": {
      proc.wall_loops = "3";
      proc.sparse_infill_density = "12%";
      proc.sparse_infill_pattern = "crosshatch";
      proc.outer_wall_speed = pVal("outer_wall_speed", nozzle === "0.2" ? 60 : 130, 150);
      proc.inner_wall_speed = pVal("inner_wall_speed", nozzle === "0.2" ? 80 : 165, 210);
      proc.sparse_infill_speed = pVal("sparse_infill_speed", nozzle === "0.2" ? 90 : 185, 230);
      break;
    }
    case "miniature": {
      if (nozzle === "0.6" || nozzle === "0.8") {
        warnings.push(
          `目前機上為 ${nozzle}mm 噴嘴；若公仔細節或文字小於 3mm，建議換裝 0.2mm 或 0.4mm 噴嘴效果更佳。`
        );
      }
      proc.wall_generator = "arachne";
      proc.wall_loops = "3";
      proc.top_shell_layers = nozzle === "0.2" ? "7" : "5";
      proc.bottom_shell_layers = nozzle === "0.2" ? "5" : "4";
      proc.outer_wall_speed = pVal("outer_wall_speed", nozzle === "0.2" ? 30 : 45);
      proc.inner_wall_speed = pVal("inner_wall_speed", nozzle === "0.2" ? 45 : 70);
      proc.small_perimeter_speed = pVal("small_perimeter_speed", 20);
      proc.initial_layer_speed = pVal("initial_layer_speed", 20);
      proc.outer_wall_acceleration = pVal("outer_wall_acceleration", 1800);
      modSet.add("support_tree_easy");
      proc.brim_type = "outer_only";
      proc.brim_width = "5";
      break;
    }
    case "precision_fit": {
      proc.precise_outer_wall = "1";
      proc.elefant_foot_compensation = "0.20";
      proc.seam_position = "aligned";
      proc.counterbore_hole_bridging = "sacrificiallayer";
      proc.outer_wall_acceleration = pVal("outer_wall_acceleration", 2500);
      proc.xy_hole_compensation = matInfo.family === "PETG" ? "0.08" : "0.04";
      break;
    }
    case "articulated": {
      proc.precise_outer_wall = "1";
      proc.elefant_foot_compensation = "0.22";
      proc.seam_position = "aligned";
      proc.brim_type = "no_brim";
      proc.brim_width = "0";
      break;
    }
    case "watertight": {
      proc.wall_loops = "5";
      proc.top_shell_layers = "6";
      proc.bottom_shell_layers = "6";
      proc.bottom_surface_pattern = "concentric";
      proc.infill_wall_overlap = "25%";
      if (nozzle === "0.6") {
        proc.outer_wall_line_width = "0.75";
        proc.inner_wall_line_width = "0.75";
      } else if (nozzle === "0.4") {
        proc.outer_wall_line_width = "0.50";
        proc.inner_wall_line_width = "0.50";
      }
      fil.filament_flow_ratio = ["1.02"];
      nozzleTemp += 5;
      break;
    }
    case "vase": {
      proc.spiral_mode = "1";
      proc.spiral_mode_smooth = "1";
      proc.wall_loops = "1";
      proc.top_shell_layers = "0";
      proc.bottom_shell_layers = "5";
      proc.sparse_infill_density = "0%";
      proc.wall_infill_order = "inner wall/outer wall/infill";
      proc.outer_wall_line_width =
        nozzle === "0.8" ? "1.10" : nozzle === "0.6" ? "0.90" : nozzle === "0.4" ? "0.65" : "0.30";
      proc.outer_wall_speed = pVal("outer_wall_speed", 45);
      break;
    }
    case "author_3mf": {
      if (authorSettings) {
        if (authorSettings.wall_loops) proc.wall_loops = String(authorSettings.wall_loops);
        if (authorSettings.sparse_infill_density) proc.sparse_infill_density = String(authorSettings.sparse_infill_density);
        if (authorSettings.sparse_infill_pattern && authorSettings.sparse_infill_pattern !== "grid") {
          proc.sparse_infill_pattern = String(authorSettings.sparse_infill_pattern);
        }
        if (authorSettings.enable_support !== undefined) proc.enable_support = String(authorSettings.enable_support);
        if (authorSettings.support_type) proc.support_type = String(authorSettings.support_type);
        if (authorSettings.brim_type) proc.brim_type = String(authorSettings.brim_type);
        if (authorSettings.brim_width) proc.brim_width = String(authorSettings.brim_width);
      }
      break;
    }
    default: {
      const custom = ext.customPresets.get(preset);
      if (custom) {
        const res = applyCommunityPatch(proc, fil, custom, nozzle, matInfo.family);
        nozzleTemp += res.tempDelta;
        if (res.mvsCap !== null) mvs = Math.min(mvs, res.mvsCap);
      }
      break;
    }
  }

  // =========================================================================
  // LAYER 3: Stackable Modifiers (Built-in + Community JSON Modifiers)
  // =========================================================================
  if (modSet.has("aligned_seam")) {
    proc.seam_position = "aligned";
    proc.override_filament_scarf_seam_setting = "0";
  }

  if (modSet.has("scarf_seam")) {
    proc.seam_position = "back";
    if (matInfo.family === "PETG") {
      proc.override_filament_scarf_seam_setting = "0";
      proc.seam_gap = "10%";
      proc.role_base_wipe_speed = "1";
    } else {
      proc.override_filament_scarf_seam_setting = "1";
      proc.seam_slope_type = "contour";
      proc.seam_slope_conditional = "1";
      proc.scarf_angle_threshold = "155";
      proc.seam_slope_min_length = "15";
      proc.seam_slope_start_height = "10%";
    }
  }

  if (modSet.has("ironing") && preset !== "vase") {
    proc.ironing_type = "top";
    proc.ironing_pattern = "rectilinear";
    proc.only_one_wall_top = "1";
    proc.top_shell_layers = String(Math.max(6, Number(proc.top_shell_layers || 5)));
    proc.ironing_speed = "30";
    proc.ironing_flow = "10%";
    proc.ironing_spacing = "0.15";
  }

  if (modSet.has("fuzzy_skin")) {
    proc.fuzzy_skin = "external";
    proc.fuzzy_skin_noise_type = "perlin";
    proc.fuzzy_skin_thickness = "0.06";
    proc.fuzzy_skin_point_distance = "0.35";
    proc.seam_position = "back";
  }

  if (modSet.has("overhang_pro")) {
    proc.wall_infill_order = "inner wall/outer wall/infill";
    proc.detect_overhang_wall = "1";
    proc.enable_overhang_speed = pVal("enable_overhang_speed", 1);
    proc.overhang_1_4_speed = pVal("overhang_1_4_speed", 0);
    proc.overhang_2_4_speed = pVal("overhang_2_4_speed", 35);
    proc.overhang_3_4_speed = pVal("overhang_3_4_speed", 20);
    proc.overhang_4_4_speed = pVal("overhang_4_4_speed", 10);
    proc.overhang_totally_speed = pVal("overhang_totally_speed", 10);
    proc.bridge_speed = pVal("bridge_speed", 25);
    proc.bridge_flow = "0.90";
  }

  const applyEasySupportSpacing = () => {
    proc.support_on_build_plate_only = "1";
    proc.bridge_no_support = "1";
    proc.support_interface_pattern = "rectilinear_interlaced";
    if (matInfo.family === "PETG") {
      // 0.4mm @0.20 uses 0.16mm (0.8x) + 5 interlaced layers + 0.50mm spacing for 1-piece snap-off on flat & curved faces;
      // >=0.6mm nozzle has higher melt mass so keep ~0.9x layer height to prevent thermal welding.
      const ratio = Number(nozzle) <= 0.4 ? 0.8 : 0.9;
      const z = Math.max(0.16, Math.round(finalLayer * ratio * 100) / 100);
      proc.support_top_z_distance = String(z);
      proc.support_bottom_z_distance = String(finalLayer);
      proc.support_interface_top_layers = "5";
      proc.support_interface_spacing = "0.50";
      proc.support_object_xy_distance = Number(nozzle) <= 0.4 ? "0.35" : "0.45";
    } else {
      const zPla = Math.max(0.12, Math.round(finalLayer * 0.85 * 100) / 100);
      proc.support_top_z_distance = String(zPla);
      proc.support_bottom_z_distance = String(finalLayer);
      proc.support_interface_top_layers = "4";
      proc.support_interface_spacing = "0.28";
      proc.support_object_xy_distance = "0.35";
    }
  };

  if (modSet.has("support_tree_easy")) {
    proc.enable_support = "1";
    proc.support_type = "tree(auto)";
    proc.support_style = "tree_slim";
    proc.support_threshold_angle = "30";
    applyEasySupportSpacing();
  }

  if (modSet.has("support_normal_snug")) {
    proc.enable_support = "1";
    proc.support_type = "normal(auto)";
    proc.support_style = "snug";
    proc.support_threshold_angle = "30";
    applyEasySupportSpacing();
  }

  if (modSet.has("support_bimat_zero")) {
    proc.enable_support = "1";
    proc.support_type = "tree(auto)";
    proc.support_style = "tree_hybrid";
    proc.support_on_build_plate_only = "1";
    proc.support_top_z_distance = "0";
    proc.support_bottom_z_distance = "0";
    proc.support_interface_top_layers = "3";
    proc.support_interface_spacing = "0";
    proc.support_interface_pattern = "rectilinear";
    proc.enable_support_ironing = "1";
    proc.support_interface_filament = "2";
  }

  if (modSet.has("counterbore_bridge")) {
    proc.counterbore_hole_bridging = "sacrificiallayer";
  }

  if (modSet.has("brim_anti_warp") && preset !== "articulated") {
    proc.brim_type = "outer_only";
    proc.brim_width = "8";
    proc.brim_object_gap = "0.1";
    proc.enable_height_slowdown = pVal("enable_height_slowdown", 1);
  } else if (modSet.has("brim_ears") && preset !== "articulated") {
    proc.brim_type = "brim_ears";
    proc.brim_width = "8";
  }

  if (modSet.has("by_object")) {
    proc.print_sequence = "by object";
  }

  if (modSet.has("silk_mirror")) {
    proc.outer_wall_speed = pVal("outer_wall_speed", 45);
    proc.z_direction_outwall_speed_continuous = "1";
    fil.no_slow_down_for_cooling_on_outwalls = ["1"];
  }

  if (modSet.has("clear_glass")) {
    proc.wall_loops = "2";
    proc.sparse_infill_density = "100%";
    proc.sparse_infill_pattern = "alignedrectilinear";
    proc.top_shell_layers = "0";
    proc.bottom_shell_layers = "0";
    proc.outer_wall_speed = pVal("outer_wall_speed", 35);
    proc.inner_wall_speed = pVal("inner_wall_speed", 35);
    proc.sparse_infill_speed = pVal("sparse_infill_speed", 35);
    fil.fan_max_speed = ["0"];
    fil.fan_min_speed = ["0"];
    fil.filament_flow_ratio = ["1.02"];
    mvs = Math.min(mvs, 8);
  }

  // Apply any community JSON modifiers
  for (const m of modSet) {
    const customMod = ext.customModifiers.get(m);
    if (customMod) {
      const res = applyCommunityPatch(proc, fil, customMod, nozzle, matInfo.family);
      nozzleTemp += res.tempDelta;
      if (res.mvsCap !== null) mvs = Math.min(mvs, res.mvsCap);
    }
  }

  // =========================================================================
  // LAYER 4: Direct User Micro-Overrides + Final Invariants
  // =========================================================================
  if (overrides.wall_loops !== undefined) proc.wall_loops = String(overrides.wall_loops);
  if (overrides.infill_percent !== undefined) {
    const pct = String(overrides.infill_percent).replace(/%$/, "");
    proc.sparse_infill_density = `${pct}%`;
  }
  if (overrides.infill_pattern) {
    if (overrides.infill_pattern === "grid") {
      warnings.push("已自動將易刮噴頭的 grid 填充替換為同級強韌不交叉的 crosshatch。");
      proc.sparse_infill_pattern = "crosshatch";
    } else {
      proc.sparse_infill_pattern = String(overrides.infill_pattern);
    }
  }
  if (overrides.brim_width !== undefined) {
    const bw = Number(overrides.brim_width);
    if (bw <= 0) {
      proc.brim_type = "no_brim";
      proc.brim_width = "0";
    } else {
      if (proc.brim_type === "no_brim") proc.brim_type = "outer_only";
      proc.brim_width = String(bw);
    }
  }
  if (overrides.xy_hole_compensation !== undefined) {
    proc.xy_hole_compensation = String(overrides.xy_hole_compensation);
  }
  if (overrides.elefant_foot_compensation !== undefined) {
    proc.elefant_foot_compensation = String(overrides.elefant_foot_compensation);
  }
  if (overrides.nozzle_temp !== undefined) nozzleTemp = Number(overrides.nozzle_temp);
  if (overrides.bed_temp !== undefined) bedTemp = Number(overrides.bed_temp);
  if (overrides.max_volumetric_speed !== undefined) mvs = Number(overrides.max_volumetric_speed);

  if (
    proc.wall_infill_order === "inner-outer-inner wall/infill" &&
    preset !== "vase" &&
    Number(proc.wall_loops || 2) < 3
  ) {
    proc.wall_loops = "3";
  }

  fil.nozzle_temperature = [String(nozzleTemp)];
  if (!fil.nozzle_temperature_initial_layer) {
    fil.nozzle_temperature_initial_layer = [String(nozzleTemp)];
  }
  fil.textured_plate_temp = [String(bedTemp)];
  fil.textured_plate_temp_initial_layer = [String(bedTemp)];
  fil.filament_max_volumetric_speed = [String(mvs)];

  if (overrides.raw_process && typeof overrides.raw_process === "object") {
    Object.assign(proc, overrides.raw_process);
  }
  if (overrides.raw_filament && typeof overrides.raw_filament === "object") {
    Object.assign(fil, overrides.raw_filament);
  }

  if (printerSpec.enclosed && (matInfo.family === "ABS" || matInfo.family === "ASA" || matInfo.family === "PC") && proc.brim_type === "no_brim") {
    warnings.push(`${matInfo.family} 易熱縮翹邊，開印前建議關門預熱熱床 100°C 15 分鐘；大面積件建議加掛 brim_anti_warp。`);
  }

  return {
    printerSpec,
    processProfile: proc,
    filamentProfile: fil,
    summary: {
      printerModel: printerSpec.id,
      printerDisplayName: printerSpec.displayName,
      nozzle,
      flowMode,
      preset,
      modifiers: [...modSet],
      filamentBase: filBaseName,
      processBase: procBaseName,
      nozzleTemp,
      bedTemp,
      maxVolumetricSpeed: mvs,
      layerHeight: Number(proc.layer_height),
      wallLoops: Number(proc.wall_loops),
      infillDensity: proc.sparse_infill_density,
      infillPattern: proc.sparse_infill_pattern,
      support: proc.enable_support === "1" ? `${proc.support_type || "auto"} (${proc.support_style || "default"})` : "無",
      brim: proc.brim_type === "no_brim" ? "無" : `${proc.brim_type} ${proc.brim_width || 8}mm`,
    },
    warnings,
  };
}
