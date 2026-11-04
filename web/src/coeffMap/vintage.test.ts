import { describe, expect, it } from "vitest";
import { formatLocationLabel, formatPlaceName } from "./vintage";

describe("formatPlaceName", () => {
  it("joins name and state when the name does not already include it", () => {
    expect(formatPlaceName({ name: "Essex County", state: "NJ" })).toBe("Essex County, NJ");
  });

  it("does not duplicate a trailing state", () => {
    expect(formatPlaceName({ name: "Denver, CO", state: "CO" })).toBe("Denver, CO");
  });

  it("falls back when the record is missing", () => {
    expect(formatPlaceName(null, "Unknown location")).toBe("Unknown location");
  });
});

describe("formatLocationLabel", () => {
  it("appends vintage after the place name", () => {
    expect(formatLocationLabel({ name: "Austin", state: "TX" }, "2024")).toBe("Austin, TX (2024)");
  });
});
