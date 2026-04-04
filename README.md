# libretro-metadatas

Static ROM metadata index built from the `libretro-database/metadat` `.dat` files.

This project is designed to publish a simple static API through GitHub Pages so ROM information can be queried quickly by:

- CRC
- file size

The generated output makes it easy to resolve basic ROM metadata without running a backend service.

## What it does

The compiler reads every `.dat` file inside [libretro-database/metadat](libretro-database\metadat), parses each `game` and `rom` entry, and generates JSON files inside [output](output).

Each generated record includes:

- `name`
- `region`
- `serial`
- `console`

The `console` field is resolved from [index.json](index.json), which maps each `.dat` filename to a `platformUniqueId`.

## Output structure

The generated static API is split into two folders:

- `output/crc/{CRC}.json`
- `output/size/{SIZE}.json`

Each file contains an array of matching records.

Example record:

```json
[
  {
    "name": "0 Story (Japan) (Disc 1).iso",
    "region": "Japan",
    "serial": "SLPM-65002",
    "console": "psx"
  }
]
```

## Build

Install Node.js, then run:

```bash
npm run build:output
```

This will:

- scan all `.dat` files under `libretro-database/metadat`
- validate that every source file has a mapped `platformUniqueId`
- recreate the `output` folder
- generate JSON lookup files by CRC and by size

You can also run the compiler directly:

```bash
node ./compiler/generate-output.js
```

## Static API usage

When published with GitHub Pages, the generated files can be fetched directly.

Examples:

```text
/output/crc/1C6ED37F.json
/output/size/4481286144.json
```

If this repository is published under GitHub Pages, a request could look like:

```text
https://<user>.github.io/<repo>/output/crc/1C6ED37F.json
https://<user>.github.io/<repo>/output/size/4481286144.json
```

This allows clients, launchers, frontends, or tooling to query ROM metadata through plain HTTP with no server-side logic.

## Data source

Source metadata comes from the `libretro-database/metadat` files included in this repository.

## Notes

- CRC output filenames are uppercase hex values.
- Size output filenames use the raw numeric size from the `.dat` entry.
- Multiple records can exist for the same CRC or size, so each file stores an array.
- Duplicate records found across multiple metadata folders are deduplicated during generation.
