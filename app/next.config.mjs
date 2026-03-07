import fs from "node:fs";
import path from "node:path";

const workspaceEnvPath = path.resolve(process.cwd(), "..", ".env");

if (fs.existsSync(workspaceEnvPath)) {
  const envLines = fs.readFileSync(workspaceEnvPath, "utf8").split(/\r?\n/);

  for (const rawLine of envLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Root .env is the single local source of truth.
    process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
