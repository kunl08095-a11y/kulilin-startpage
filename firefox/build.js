"use strict";

// Assemble an unsigned Firefox package from the shared extension files
// plus firefox/manifest.json. The repo-root Chrome/Edge manifest is not used.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const stage = path.join(__dirname, "dist", "stage");
const zipPath = process.env.KULILIN_FIREFOX_ZIP
  ? path.resolve(process.env.KULILIN_FIREFOX_ZIP)
  : path.join(__dirname, "dist", "KULILIN-firefox-1.7.0-unsigned.zip");

const sharedFiles = ["app.js", "url.js", "index.html"];

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.mkdirSync(path.dirname(zipPath), { recursive: true });

for (const file of sharedFiles) {
  fs.copyFileSync(path.join(repoRoot, file), path.join(stage, file));
}
fs.cpSync(path.join(repoRoot, "icons"), path.join(stage, "icons"), {
  recursive: true,
});
fs.copyFileSync(
  path.join(__dirname, "manifest.json"),
  path.join(stage, "manifest.json")
);

if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath);
}

execFileSync(
  "zip",
  ["-X", "-D", "-r", zipPath, ...sharedFiles, "manifest.json", "icons"],
  { cwd: stage, stdio: "inherit" }
);

process.stdout.write(`${zipPath}\n`);
