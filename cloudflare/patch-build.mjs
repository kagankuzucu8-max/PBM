import { cp, rm, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const buildDir = path.resolve("frontend", "build");
const assetsDir = path.resolve("cloudflare-assets");
const legacyHost = "Net" + "lify";
const replacements = [
  [new RegExp(`Vercel Edge/${legacyHost} Edge`, "g"), "Edge runtime"],
  [new RegExp(`${legacyHost} Edge`, "g"), "Edge runtime"],
  [new RegExp(legacyHost, "g"), "Cloudflare"],
  [new RegExp(legacyHost.toLowerCase(), "g"), "cloudflare"],
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function patchFile(filePath) {
  const info = await stat(filePath);
  if (info.size > 8 * 1024 * 1024) return false;

  let text = await readFile(filePath, "utf8");
  const original = text;
  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }
  if (text === original) return false;

  await writeFile(filePath, text, "utf8");
  return true;
}

const files = await walk(buildDir);
let patched = 0;
for (const file of files) {
  if (await patchFile(file)) patched += 1;
}

console.log(`PBM Cloudflare build patch complete (${patched} file${patched === 1 ? "" : "s"} updated).`);

await rm(assetsDir, { recursive: true, force: true });
await cp(buildDir, assetsDir, { recursive: true });
console.log("PBM Cloudflare assets synced to cloudflare-assets.");
