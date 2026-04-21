import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";
import recordOutputUtils from "../utils/record-output.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../output");
const { ensureRecordDirs, writeRecordGroup } = recordOutputUtils;

function ensureDirs() {
  const dirs = ["crc"];
  for (const dir of dirs) {
    const fullPath = path.join(OUTPUT_DIR, dir);
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

function saveJson(dir, key, data) {
  const filePath = path.join(OUTPUT_DIR, dir, `${key.toLowerCase()}.json`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

async function fetchXML() {
  const res = await fetch("http://nswdb.com/xml.php");
  if (!res.ok) {
    throw new Error(`HTTP error: ${res.status}`);
  }
  return res.text();
}

function parseXML(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
  });

  const json = parser.parse(xml);

  let releases = json?.releases?.release;

  if (!Array.isArray(releases)) {
    releases = [releases];
  }

  return releases;
}

function processReleases(releases) {
  const crcMap = new Map();
  const serialMap = new Map();
  const sizeMap = new Map();

  for (const r of releases) {
    const obj = {
      name: r.name,
      region: r.region,
      serial: r.serial,
      console: "switch",
    };

    if (r.idcrc) {
      if (!crcMap.has(r.idcrc)) crcMap.set(r.idcrc, []);
      crcMap.get(r.idcrc).push(obj);
    }

    if (r.filename) {
      if (!serialMap.has(r.filename)) serialMap.set(r.filename, []);
      serialMap.get(r.filename).push(obj);
    }

    if (r.trimmedsize) {
      if (!sizeMap.has(r.trimmedsize)) sizeMap.set(r.trimmedsize, []);
      sizeMap.get(r.trimmedsize).push(obj);
    }
  }

  return { crcMap, serialMap, sizeMap };
}

async function saveAll({ crcMap, serialMap, sizeMap }) {
  await ensureRecordDirs(OUTPUT_DIR);
  await writeRecordGroup(OUTPUT_DIR, {
    dirName: "serial",
    sourceMap: serialMap,
    aggregateFilename: "all-serials.json",
    skipExistingFiles: true,
  });
  await writeRecordGroup(OUTPUT_DIR, {
    dirName: "size",
    sourceMap: sizeMap,
    aggregateFilename: "all-sizes.json",
    skipExistingFiles: true,
  });
}

async function main() {
  try {
    console.log("Fetching XML...");
    const xml = await fetchXML();

    console.log("Parsing...");
    const releases = parseXML(xml);

    console.log(`Found ${releases.length} releases`);

    ensureDirs();

    const grouped = processReleases(releases);

    console.log("Saving files...");
    await saveAll(grouped);

    console.log("Done!");
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
