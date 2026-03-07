import { describe, expect, it } from "bun:test";
import { parseExplorerMode } from "./explorer-mode";

describe("explorer mode", () => {
  it("defaults to browse", () => {
    expect(parseExplorerMode(undefined)).toBe("browse");
  });

  it("accepts analyze mode", () => {
    expect(parseExplorerMode("analyze")).toBe("analyze");
  });

  it("falls back to browse for invalid values", () => {
    expect(parseExplorerMode("invalid")).toBe("browse");
  });
});
