import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const targetDir = join(root, "public", "geojson");

mkdirSync(targetDir, { recursive: true });

const files = readdirSync(targetDir).filter((file) => file.endsWith(".geojson"));
console.log(`GeoJSON source of truth: ${targetDir} (${files.length} files)`);
