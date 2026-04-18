import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.resolve(
  __dirname,
  "../cachyos-ananicy-db/00-default/Games/wine_proton"
);

const OUTPUT_PATH = path.resolve(__dirname, "../output/wine-proton-execs.json");

function extractTitle(commentLine) {
  return commentLine
    .replace(/^#/, "")
    .trim()
    .replace(/https?:\/\/\S+/g, "")
    .trim();
}

function extractExec(line) {
  try {
    const match = line.match(/\{.*\}/);
    if (!match) return null;

    const json = JSON.parse(match[0]);

    if (json.type !== "Game") return null;
    if (!json.name) return null;

    return json.name;
  } catch {
    return null;
  }
}

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const results = [];

  let currentTitle = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith("#")) {
      const title = extractTitle(line);

      if (title.length > 0) {
        currentTitle = title;
      }

      continue;
    }

    if (line.startsWith("{")) {
      const exec = extractExec(line);

      if (!exec || !currentTitle) continue;

      results.push({
        name: currentTitle,
        exec,
      });
    }
  }

  return results;
}

function main() {
  try {
    const files = fs
      .readdirSync(INPUT_DIR)
      .filter((f) => f.endsWith(".rules") && f !== "common.rules");

    const finalResults = [];

    for (const file of files) {
      const fullPath = path.join(INPUT_DIR, file);

      const parsed = parseFile(fullPath);

      finalResults.push(...parsed);
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalResults, null, 2));

    console.log(`✅ Parsed ${finalResults.length} entries`);
    console.log(`📁 Saved to ${OUTPUT_PATH}`);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();