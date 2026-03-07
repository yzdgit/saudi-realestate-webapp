export type ExplorerMode = "browse" | "analyze";

export const defaultExplorerMode: ExplorerMode = "browse";

const modeValues: ExplorerMode[] = ["browse", "analyze"];

export function parseExplorerMode(value: string | string[] | undefined): ExplorerMode {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return defaultExplorerMode;
  }

  return modeValues.includes(raw as ExplorerMode) ? (raw as ExplorerMode) : defaultExplorerMode;
}
