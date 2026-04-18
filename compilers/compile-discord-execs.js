import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.resolve(__dirname, "../discord-api/current.json");
const OUTPUT_PATH = path.resolve(__dirname, "../output/discord-execs.json");

function main() {
  try {
    const raw = fs.readFileSync(INPUT_PATH, "utf-8");
    const data = JSON.parse(raw);

    const result = [];

    for (const app of data) {
      if (!Array.isArray(app.executables) || app.executables.length === 0) {
        continue;
      }

      for (const exe of app.executables) {
        if (exe.os && exe.os !== "win32") continue;

        if (!exe.name) continue;

        result.push({
          "discord-id": app.id,
          exec: exe.name,
          name: app.name,
        });
      }
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

    console.log(`Generated ${result.length} entries`);
    console.log(`Saved to: ${OUTPUT_PATH}`);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();