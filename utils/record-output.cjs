const fsp = require("fs/promises");
const path = require("path");

function removeInvalidPathChars(name) {
  return String(name).replace(/[/\\?%*:|"<>]/g, "_");
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
  return String(left || "").localeCompare(String(right || ""));
}

function toRecordList(recordCollection, sortRecords) {
  const records =
    recordCollection instanceof Map
      ? [...recordCollection.values()]
      : [...recordCollection];

  if (!sortRecords) {
    return records;
  }

  return records.sort(compareRecords);
}

function serializeRecords(records) {
  return `${JSON.stringify(records, null)}`;
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
    }
    throw error;
  }
}

function mergeRecordArrays(existingRecords, incomingRecords, sortRecords) {
  const merged = new Map();

  for (const record of existingRecords) {
    merged.set(JSON.stringify(record), record);
  }

  for (const record of incomingRecords) {
    merged.set(JSON.stringify(record), record);
  }

  return toRecordList(merged, sortRecords);
}

function normalizeAggregateData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

async function ensureRecordDirs(outputDir) {
  await Promise.all([
    fsp.mkdir(path.join(outputDir, "serial"), { recursive: true }),
    fsp.mkdir(path.join(outputDir, "size"), { recursive: true }),
  ]);
}

async function writeRecordGroup(outputDir, options) {
  const {
    dirName,
    sourceMap,
    aggregateFilename,
    sortRecords = false,
    skipExistingFiles = false,
  } = options;

  const targetDir = path.join(outputDir, dirName);
  await fsp.mkdir(targetDir, { recursive: true });

  const aggregatePath = path.join(outputDir, aggregateFilename);
  const aggregate = normalizeAggregateData(
    await readJsonFile(aggregatePath, {}),
  );

  for (const [key, recordCollection] of sourceMap.entries()) {
    const records = toRecordList(recordCollection, sortRecords);
    const aggregateRecords = Array.isArray(aggregate[key])
      ? aggregate[key]
      : [];
    const mergedRecords = mergeRecordArrays(
      aggregateRecords,
      records,
      sortRecords,
    );

    aggregate[key] = mergedRecords;
  }

  await fsp.writeFile(aggregatePath, serializeRecords(aggregate), "utf8");
}

module.exports = {
  compareRecords,
  ensureRecordDirs,
  removeInvalidPathChars,
  writeRecordGroup,
};
