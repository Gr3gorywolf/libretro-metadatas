import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.resolve(
  __dirname,
  "../libretro-roms-scraper/output/infos"
);

const OUTPUT_DIR = path.resolve(__dirname, "../output/libretro-by-slug");
const FULLSET_DIR = path.resolve(__dirname, "../output/libretro-gamesdb");
const INDEX_PATH = path.resolve(__dirname, "../output/libretro-index.json");
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function writeIfNotExists(filePath, data) {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, JSON.stringify(data));
}

function main() {
  try {
    const files = fs
      .readdirSync(INPUT_DIR)
      .filter((f) => f.endsWith(".json"));

    ensureDir(OUTPUT_DIR);

    const index = [];

    for (const file of files) {
      const fullPath = path.join(INPUT_DIR, file);
      const raw = fs.readFileSync(fullPath, "utf-8");
      const data = JSON.parse(raw);

      const consoleSlug = data?.console?.slug;
      if (!consoleSlug) continue;

      for (const game of data.games || []) {
        if (!game?.name) continue;

        const gameSlug = slugify(game.name);
        const finalSlug = game.slug ?? `${consoleSlug}-${gameSlug}`;

        const outputFile = path.join(OUTPUT_DIR, `${finalSlug}.json`);

        writeIfNotExists(outputFile, game);

        index.push({
          name: game.name,
          slug: finalSlug,
          console: consoleSlug,
        });
      }
    }

    fs.writeFileSync(INDEX_PATH, JSON.stringify(index));

    fs.renameSync(INPUT_DIR, FULLSET_DIR);

    console.log(`✅ Games processed: ${index.length}`);
    console.log(`📁 Output dir: ${OUTPUT_DIR}`);
    console.log(`📄 Index file: ${INDEX_PATH}`);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();