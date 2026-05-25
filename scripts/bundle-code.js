const fs = require("fs");
const path = require("path");

// Fichier final généré à la racine absolue du projet NOD
const outputFile = path.join(__dirname, "../code_complet_nod.txt");
const rootDir = path.join(__dirname, "../");

// Extensions autorisées pour l'analyse d'ingénierie réelle
const allowedExtensions = [".ts", ".tsx", ".json", ".css"];
// Dossiers système lourds à ignorer pour protéger ton i5 et économiser les tokens
const ignoredFolderNames = [
  "node_modules",
  ".next",
  "out",
  "scripts",
  ".git",
  "open-design",
  ".agents",
];

let fileCounter = 0;
fs.writeFileSync(outputFile, `# CODEBASE LIVE REELS STATUS — NOD PWA\n\n`);

function scanDirectory(currentDir) {
  const files = fs.readdirSync(currentDir);

  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!ignoredFolderNames.includes(file)) {
        scanDirectory(fullPath);
      }
    } else {
      const ext = path.extname(file);
      if (
        allowedExtensions.includes(ext) &&
        !file.endsWith(".d.ts") &&
        !file.includes("package-lock") &&
        !file.includes("pnpm-lock")
      ) {
        const relativePath = path.relative(rootDir, fullPath);
        const content = fs.readFileSync(fullPath, "utf8");

        fs.appendFileSync(
          outputFile,
          `\n\n--- FICHIER : ${relativePath} ---\n\`\`\`\n${content}\n\`\`\`\n`,
        );
        fileCounter++;
      }
    }
  }
}

console.log("⏳ Analyse et regroupement de ton code en cours...");
scanDirectory(rootDir);
console.log(
  `✅ Extraction validée : ${fileCounter} fichiers assemblés dans code_complet_nod.txt`,
);
