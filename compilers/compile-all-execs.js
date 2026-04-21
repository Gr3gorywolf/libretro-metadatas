import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISCORD_PATH = path.resolve(__dirname, "../output/discord-execs.json");
const WINE_PATH = path.resolve(__dirname, "../output/wine-proton-execs.json");

const OUTPUT_PATH = path.resolve(__dirname, "../output/all-execs.json");
const OUTPUT_RAW_PATH = path.resolve(__dirname, "../output/all-execs-raw.json");
const EXECS_DIR = path.resolve(__dirname, "../output/execs");

function normalizeExec(exec) {
  return exec.toLowerCase().trim();
}

function toSha1(str) {
  return createHash("sha1").update(str).digest("hex");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createExecFile(key, data) {
  const filename = `${toSha1(key)}.json`;
  const filePath = path.join(EXECS_DIR, filename);

  if (fs.existsSync(filePath)) return;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getExecVariants(exec) {
  const normalized = normalizeExec(exec);

  const variants = new Set();
  variants.add(normalized);

  if (normalized.includes("/")) {
    const base = normalized.split("/").pop();
    if (base) variants.add(base);
  }

  return Array.from(variants);
}

function main() {
  try {
    const discord = JSON.parse(fs.readFileSync(DISCORD_PATH, "utf-8"));
    const wine = JSON.parse(fs.readFileSync(WINE_PATH, "utf-8"));

    const map = new Map();

    for (const item of discord) {
      const key = normalizeExec(item.exec);

      if (!map.has(key)) {
        map.set(key, {
          name: item.name,
          exec: item.exec,
          source: "discord",
          "discord-id": item["discord-id"],
        });
      }
    }

    for (const item of wine) {
      const key = normalizeExec(item.exec);

      if (!map.has(key)) {
        map.set(key, {
          name: item.name,
          exec: item.exec,
          source: "wine-proton",
        });
      }
    }

    const result = Array.from(map.values());
    const resultRaw = result.map((entry) => entry.exec);

    ensureDir(path.dirname(OUTPUT_PATH));
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result));
    fs.writeFileSync(OUTPUT_RAW_PATH, JSON.stringify(resultRaw));

    ensureDir(EXECS_DIR);
    console.log(`✅ Combined entries: ${result.length}`);
    console.log(`📁 Exec files generated in: ${EXECS_DIR}`);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
