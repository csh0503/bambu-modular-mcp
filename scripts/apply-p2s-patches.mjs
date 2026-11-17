#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Applies two small compatibility fixes to bambu-printer-mcp@1.1.79 for Bambu Lab P2S:
 * 1) Upload P2S .gcode.3mf files to the SD card root ("/<name>") instead of "/cache/<name>" (avoids FTPS 553).
 * 2) Treat post-cancel FAILED state (fail_reason 0 or 0x0300400C, print_error 0) on P2S as safely idle.
 */
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetPkgDir = path.join(rootDir, "node_modules", "bambu-printer-mcp", "dist");

if (!fs.existsSync(targetPkgDir)) {
  process.exit(0);
}

const bambuJsPath = path.join(targetPkgDir, "printers", "bambu.js");
if (fs.existsSync(bambuJsPath)) {
  let src = fs.readFileSync(bambuJsPath, "utf8");
  const before = "const remoteProjectPath = isH2 || isA1 ? remoteFileName : `cache/${remoteFileName}`;";
  const after = "const remoteProjectPath = isH2 || isA1 || isP2S ? remoteFileName : `cache/${remoteFileName}`;";
  if (src.includes(before)) {
    src = src.replace(before, after);
    fs.writeFileSync(bambuJsPath, src, "utf8");
    console.log("[bambu-modular-mcp] Applied P2S SD-root FTPS upload fix.");
  }
}

const stateJsPath = path.join(targetPkgDir, "safety", "printer-state.js");
if (fs.existsSync(stateJsPath)) {
  let src = fs.readFileSync(stateJsPath, "utf8");
  let changed = false;
  if (src.includes('normalizeModel(model) === "x2d" && raw.gcode_state === "FAILED"')) {
    src = src.replace(
      'normalizeModel(model) === "x2d" && raw.gcode_state === "FAILED"',
      '["x2d", "p2s"].includes(normalizeModel(model)) && raw.gcode_state === "FAILED"'
    );
    changed = true;
  }
  if (src.includes("finiteNumber(raw.fail_reason) === 0x0300400c")) {
    src = src.replace(
      "finiteNumber(raw.fail_reason) === 0x0300400c",
      "[0, 0x0300400c].includes(finiteNumber(raw.fail_reason))"
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(stateJsPath, src, "utf8");
    console.log("[bambu-modular-mcp] Applied P2S post-cancel state recovery fix.");
  }
}
