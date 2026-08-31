import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const workspace = process.cwd();
const sourceZip = "D:\\download\\宝可梦璀璨宝石\\宝可梦璀璨宝石.zip";
const outputRoot = path.join(workspace, "assets", "source-cards");
const reportPath = path.join(workspace, "docs", "assets", "card-inventory.json");

const groups = [
  { folder: "tier-1", prefix: "tier-1" },
  { folder: "tier-3", prefix: "tier-3" },
  { folder: "tier-2", prefix: "tier-2" },
  { folder: "legendary", prefix: "legendary" },
  { folder: "icons", prefix: "icon" },
  { folder: "rare", prefix: "rare" },
];

function assertInsideWorkspace(targetPath) {
  const relative = path.relative(workspace, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside workspace: ${targetPath}`);
  }
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function zipListing() {
  const raw = execFileSync("python", [
    "-c",
    [
      "import zipfile, json",
      `z=${JSON.stringify(sourceZip)}`,
      "with zipfile.ZipFile(z) as f:",
      "  print(json.dumps([{'index': i, 'name': info.filename, 'size': info.file_size, 'dir': info.is_dir()} for i, info in enumerate(f.infolist())]))",
    ].join("\n"),
  ], { encoding: "utf8" });
  return JSON.parse(raw);
}

function zipRead(entryName) {
  return execFileSync("python", [
    "-c",
    [
      "import zipfile, sys",
      `z=${JSON.stringify(sourceZip)}`,
      `name=${JSON.stringify(entryName)}`,
      "with zipfile.ZipFile(z) as f:",
      "  sys.stdout.buffer.write(f.read(name))",
    ].join("\n"),
  ]);
}

if (fs.existsSync(outputRoot)) {
  const existing = fs.readdirSync(outputRoot, { withFileTypes: true });
  if (existing.length) {
    throw new Error(`${outputRoot} already exists and is not empty`);
  }
}

fs.mkdirSync(outputRoot, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const entries = zipListing();
const imageEntries = entries.filter((entry) => !entry.dir && /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(entry.name));
const topDirs = [];
for (const entry of imageEntries) {
  const normalized = entry.name.replaceAll("\\", "/");
  const topDir = normalized.split("/")[0] ?? "";
  if (!topDirs.includes(topDir)) topDirs.push(topDir);
}

const groupByTopDir = new Map(topDirs.map((topDir, index) => [topDir, { ...groups[index], topDir, files: [] }]));
for (const entry of imageEntries) {
  const normalized = entry.name.replaceAll("\\", "/");
  const topDir = normalized.split("/")[0] ?? "";
  const group = groupByTopDir.get(topDir);
  if (!group) continue;
  group.files.push(entry);
}

const inventory = {
  sourceZip,
  outputRoot,
  importedAt: new Date().toISOString(),
  imageCount: imageEntries.length,
  formats: {},
  folders: [],
  files: [],
};

for (const group of groupByTopDir.values()) {
  const dir = path.join(outputRoot, group.folder);
  assertInsideWorkspace(dir);
  fs.mkdirSync(dir, { recursive: true });
  inventory.folders.push({
    sourceTopDirectory: group.topDir,
    normalizedFolder: `assets/source-cards/${group.folder}`,
    imageCount: group.files.length,
  });

  group.files.forEach((entry, index) => {
    const ext = path.extname(entry.name).toLowerCase() || ".png";
    inventory.formats[ext.slice(1)] = (inventory.formats[ext.slice(1)] ?? 0) + 1;
    const filename = `${group.prefix}-${String(index + 1).padStart(3, "0")}${ext}`;
    const target = path.join(dir, filename);
    assertInsideWorkspace(target);
    const bytes = zipRead(entry.name);
    fs.writeFileSync(target, bytes, { flag: "wx" });
    const size = pngSize(bytes);
    inventory.files.push({
      sourceIndex: entry.index,
      originalPath: entry.name,
      normalizedPath: `assets/source-cards/${group.folder}/${filename}`,
      format: ext.slice(1),
      byteLength: entry.size,
      width: size?.width ?? null,
      height: size?.height ?? null,
      inferredGroup: group.folder,
      recognitionStatus: group.folder === "icons" ? "asset" : "pending",
    });
  });
}

fs.writeFileSync(reportPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(`Imported ${inventory.files.length} images to ${outputRoot}`);
console.log(`Inventory written to ${reportPath}`);
