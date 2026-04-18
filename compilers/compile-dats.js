const fs = require("fs/promises");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const METADAT_DIR = path.join(ROOT_DIR, "libretro-database", "metadat");
const INDEX_PATH = path.join(ROOT_DIR, "index.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const CRC_DIR = path.join(OUTPUT_DIR, "crc");
const SERIAL_DIR = path.join(OUTPUT_DIR, "serial");
const SIZE_DIR = path.join(OUTPUT_DIR, "size");

async function main() {
  const consoleIndex = await loadConsoleIndex();
  const datFiles = await findDatFiles(METADAT_DIR);

  const crcRecords = new Map();
  const sizeRecords = new Map();
  const serialRecords = new Map();
  const unmappedFiles = new Set();

  for (const datFile of datFiles) {
    const datName = path.basename(datFile, ".dat");
    const consoleId = getConsoleId(consoleIndex, datName);

    if (!consoleId) {
      unmappedFiles.add(datName);
      continue;
    }

    const content = await fs.readFile(datFile, "utf8");
    const games = parseGames(content);

    for (const game of games) {
      for (const rom of game.roms) {
        const record = {
          name: rom.name,
          region: game.region || null,
          serial: rom.serial || game.serial || null,
          console: consoleId,
        };

        if (rom.crc) {
          addRecord(crcRecords, rom.crc.toUpperCase(), record);
        }

        if (rom.size) {
          addRecord(sizeRecords, rom.size, record);
        }

        if (rom.serial) {
          addRecord(serialRecords, rom.serial.toLowerCase(), record);
        }
      }
    }
  }

  if (unmappedFiles.size > 0) {
    const names = [...unmappedFiles].sort();
    throw new Error(
      [
        "Some .dat files do not have a platformUniqueId in index.json.",
        "Fill in these names before generating output:",
        ...names.map((name) => `- ${name}`),
      ].join("\n")
    );
  }

  await resetOutputDir(OUTPUT_DIR);
  await fs.mkdir(CRC_DIR, { recursive: true });
  await fs.mkdir(SIZE_DIR, { recursive: true });
  await fs.mkdir(SERIAL_DIR, { recursive: true });
  await writeRecordFiles(CRC_DIR, crcRecords);
  await writeRecordFiles(SIZE_DIR, sizeRecords);
  await writeRecordFiles(SERIAL_DIR, serialRecords);

  console.log(`Processed ${datFiles.length} .dat files`);
  console.log(`Generated ${crcRecords.size} files in output/crc`);
  console.log(`Generated ${sizeRecords.size} files in output/size`);
  console.log(`Generated ${serialRecords.size} files in output/serial`);
}

async function loadConsoleIndex() {
  const raw = await fs.readFile(INDEX_PATH);
  return JSON.parse(stripBom(raw.toString("utf8")));
}

async function findDatFiles(rootDir) {
  const results = [];
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findDatFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".dat")) {
      results.push(fullPath);
    }
  }

  return results;
}

function getConsoleId(consoleIndex, datName) {
  const entry = consoleIndex[datName];
  if (!entry || !entry.platformUniqueId) {
    return null;
  }
  return entry.platformUniqueId;
}

function addRecord(targetMap, key, record) {
  let recordMap = targetMap.get(key);
  if (!recordMap) {
    recordMap = new Map();
    targetMap.set(key, recordMap);
  }

  const recordKey = JSON.stringify(record);
  if (!recordMap.has(recordKey)) {
    recordMap.set(recordKey, record);
  }
}

async function resetOutputDir(outputDir) {
  await fs.rm(outputDir, { recursive: true, force: true });
}

async function writeRecordFiles(outputDir, sourceMap) {
  for (const [key, recordMap] of sourceMap.entries()) {
    const outputPath = path.join(outputDir, `${key}.json`);
    const records = [...recordMap.values()].sort(compareRecords);
    const json = `${JSON.stringify(records, null, 2)}\n`;
    await fs.writeFile(outputPath, json, "utf8");
  }
}

function compareRecords(left, right) {
  return (
    compareText(left.console, right.console) ||
    compareText(left.name, right.name) ||
    compareText(left.region || "", right.region || "") ||
    compareText(left.serial || "", right.serial || "")
  );
}

function compareText(left, right) {
  return left.localeCompare(right);
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function parseGames(content) {
  const lines = content.split(/\r?\n/);
  const games = [];
  let currentGameLines = null;
  let gameDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!currentGameLines) {
      if (trimmed.startsWith("game (")) {
        currentGameLines = [line];
        gameDepth = getParenDelta(line);
      }
      continue;
    }

    currentGameLines.push(line);
    gameDepth += getParenDelta(line);

    if (gameDepth <= 0) {
      const game = parseGameBlock(currentGameLines);
      if (game.roms.length > 0) {
        games.push(game);
      }
      currentGameLines = null;
      gameDepth = 0;
    }
  }

  return games;
}

function parseGameBlock(lines) {
  const game = {
    name: null,
    region: null,
    serial: null,
    roms: [],
  };

  let inRom = false;
  let romDepth = 0;
  let romLines = [];

  for (const rawLine of lines.slice(1, -1)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (inRom) {
      romLines.push(line);
      romDepth += getParenDelta(line);
      if (romDepth <= 0) {
        const rom = parseRomBlock(romLines.join(" "));
        if (rom.name && (rom.crc || rom.size)) {
          game.roms.push(rom);
        }
        inRom = false;
        romDepth = 0;
        romLines = [];
      }
      continue;
    }

    if (line.startsWith("rom (")) {
      inRom = true;
      romLines = [line];
      romDepth = getParenDelta(line);
      if (romDepth <= 0) {
        const rom = parseRomBlock(romLines.join(" "));
        if (rom.name && (rom.crc || rom.size)) {
          game.roms.push(rom);
        }
        inRom = false;
        romDepth = 0;
        romLines = [];
      }
      continue;
    }

    if (!game.name) {
      const match = line.match(/^name\s+"([^"]+)"$/);
      if (match) {
        game.name = match[1];
        continue;
      }
    }

    if (!game.region) {
      const match = line.match(/^region\s+"([^"]+)"$/);
      if (match) {
        game.region = match[1];
        continue;
      }
    }

    if (!game.serial) {
      const match = line.match(/^serial\s+"([^"]+)"$/);
      if (match) {
        game.serial = match[1];
      }
    }
  }

  return game;
}

function parseRomBlock(line) {
  return {
    name: matchQuotedValue(line, "name"),
    size: matchNumberValue(line, "size"),
    crc: matchTokenValue(line, "crc"),
    serial: matchQuotedValue(line, "serial"),
  };
}

function matchQuotedValue(text, key) {
  const match = text.match(new RegExp(`${escapeRegex(key)}\\s+"([^"]+)"`));
  return match ? match[1] : null;
}

function matchNumberValue(text, key) {
  const match = text.match(new RegExp(`${escapeRegex(key)}\\s+(\\d+)`));
  return match ? match[1] : null;
}

function matchTokenValue(text, key) {
  const match = text.match(new RegExp(`${escapeRegex(key)}\\s+([A-Za-z0-9]+)`));
  return match ? match[1] : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getParenDelta(line) {
  let delta = 0;
  for (const char of line) {
    if (char === "(") {
      delta += 1;
    } else if (char === ")") {
      delta -= 1;
    }
  }
  return delta;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
