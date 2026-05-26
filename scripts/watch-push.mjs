#!/usr/bin/env node
/**
 * NOD — Auto Push on Save
 * Lance en arrière-plan et pousse automatiquement sur GitHub à chaque modification.
 * Utilisation : node scripts/watch-push.mjs
 * Prérequis : npm install -D chokidar
 */

import { watch } from "chokidar";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function bumpVersion() {
  const versionFilePath = path.join(ROOT, "VERSION");
  const tsFilePath = path.join(ROOT, "src", "constants", "version.ts");
  
  let versionStr = "1.4.6";
  if (fs.existsSync(versionFilePath)) {
    versionStr = fs.readFileSync(versionFilePath, "utf8").trim();
  }
  
  const parts = versionStr.split(".");
  if (parts.length === 3) {
    const patch = parseInt(parts[2], 10);
    if (!isNaN(patch)) {
      parts[2] = (patch + 1).toString();
    }
  } else {
    parts[0] = "1";
    parts[1] = "4";
    parts[2] = "7";
  }
  
  const newVersionStr = parts.join(".");
  fs.writeFileSync(versionFilePath, newVersionStr, "utf8");
  fs.writeFileSync(tsFilePath, `export const VERSION = "${newVersionStr}";\n`, "utf8");
  return newVersionStr;
}

const GOLD = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const IGNORED = [
  "node_modules",
  ".next",
  ".git",
  ".env*",
  "*.log",
  "scripts/watch-push.mjs",
  "VERSION",
  "src/constants/version.ts",
];

let debounceTimer = null;
let busy = false;

console.log(`\n${BOLD}${GOLD}👑 NOD — Auto-Push Watcher activé${RESET}`);
console.log(`${DIM}Surveille : ${ROOT}${RESET}`);
console.log(`${DIM}Chaque sauvegarde → commit automatique → git push origin main${RESET}\n`);

async function autoPush(changedFile) {
  if (busy) return;
  busy = true;

  const rel = path.relative(ROOT, changedFile);
  const timestamp = new Date().toLocaleTimeString("fr-FR");

  try {
    // Vérifier s'il y a des changements réels
    const { stdout: statusOut } = await execAsync("git status --porcelain", { cwd: ROOT });
    if (!statusOut.trim()) {
      busy = false;
      return;
    }

    console.log(`\n${GOLD}⚡ ${timestamp}${RESET} — Changement détecté : ${BOLD}${rel}${RESET}`);

    // Bump version and generate src/constants/version.ts statically
    const newVersion = bumpVersion();
    console.log(`  ${GOLD}✓ SemVer Bumped: ${BOLD}v${newVersion}${RESET}`);

    // Stage all changes including VERSION and version.ts
    await execAsync("git add -A", { cwd: ROOT });
    console.log(`  ${DIM}✓ git add -A${RESET}`);

    // Commit with automatic SemVer tag and timestamp
    const commitMsg = `auto: v${newVersion} - ${rel} @ ${timestamp}`;
    await execAsync(`git commit -m "${commitMsg}"`, { cwd: ROOT });
    console.log(`  ${DIM}✓ commit: "${commitMsg}"${RESET}`);

    // Push
    const { stdout: pushOut } = await execAsync("git push origin main", { cwd: ROOT });
    console.log(`  ${GREEN}✅ Poussé sur GitHub → Vercel déploie automatiquement${RESET}`);
    if (pushOut.trim()) console.log(`  ${DIM}${pushOut.trim()}${RESET}`);

  } catch (err) {
    const msg = err.stderr || err.message || String(err);
    if (msg.includes("nothing to commit")) {
      console.log(`  ${DIM}Aucun changement à commiter.${RESET}`);
    } else if (msg.includes("up-to-date")) {
      console.log(`  ${DIM}Déjà à jour.${RESET}`);
    } else {
      console.error(`  ${RED}❌ Erreur push : ${msg}${RESET}`);
    }
  } finally {
    busy = false;
  }
}

const watcher = watch(ROOT, {
  ignored: (p) => {
    const rel = path.relative(ROOT, p);
    return IGNORED.some((pattern) => {
      if (pattern.includes("*")) {
        const base = pattern.replace("*", "");
        return rel.startsWith(base) || path.basename(p).startsWith(base);
      }
      return rel.startsWith(pattern) || p.includes(`/${pattern}/`);
    });
  },
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
});

watcher.on("change", (filePath) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => autoPush(filePath), 800);
});

watcher.on("add", (filePath) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => autoPush(filePath), 800);
});

watcher.on("unlink", (filePath) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => autoPush(filePath), 800);
});

watcher.on("error", (err) => {
  console.error(`${RED}Watcher error: ${err}${RESET}`);
});

process.on("SIGINT", () => {
  console.log(`\n${DIM}Watcher arrêté.${RESET}\n`);
  watcher.close();
  process.exit(0);
});
