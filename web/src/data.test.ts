import { describe, expect, it } from "vitest";
import {
  convertAmount,
  convertAmountWithLocation,
  geometricComposite,
  rebaseSeries,
  type InflationData,
} from "./data";

const data: InflationData = {
  meta: {
    baseMonth: "1995-01",
    birthDate: "1995-01-20",
    defaultAnchorDate: "1995-01-20",
    firstMonth: "1995-01",
    retrieved: "2026-11-03",
    latestMonth: "1995-03",
    method: "",
    notes: {},
  },
  months: ["1995-01", "1995-02", "1995-03"],
  series: [],
  levels: {
    a: [1, 2, 4],
    b: [1, 8, 16],
    gap: [1, null, 4],
  },
};

describe("geometricComposite", () => {
  it("returns one in the base month and the weighted geometric mean later", () => {
    const values = geometricComposite(data, { a: 1, b: 1 });
    expect(values[0]).toBe(1);
    expect(values[1]).toBeCloseTo(4);
    expect(values[2]).toBeCloseTo(8);
  });

  it("does not silently reweight a basket when a positive-weight component is missing", () => {
    const values = geometricComposite(data, { a: 1, gap: 1 });
    expect(values[1]).toBeNull();
  });
});

describe("rebaseSeries", () => {
  it("sets the selected anchor month to one and preserves ratios around it", () => {
    expect(rebaseSeries(data.months, data.levels.a, "1995-02-20")).toEqual([0.5, 1, 2]);
  });

  it("omits a series when it has no observation in the anchor month", () => {
    expect(rebaseSeries(data.months, data.levels.gap, "1995-02-20")).toEqual([null, null, null]);
  });
});

describe("convertAmount", () => {
  it("converts forward using the coefficient ratio", () => {
    const result = convertAmount(10, "1995-01-20", "1995-03-02", data.months, data.levels.a);
    expect(result.result).toBe(40);
    expect(result.factor).toBe(4);
  });

  it("is reversible", () => {
    const forward = convertAmount(10, "1995-01-01", "1995-03-01", data.months, data.levels.a);
    const reverse = convertAmount(forward.result, "1995-03-01", "1995-01-01", data.months, data.levels.a);
    expect(reverse.result).toBeCloseTo(10);
  });

  it("uses the nearest prior observation when a month is missing", () => {
    const result = convertAmount(10, "1995-02-10", "1995-03-01", data.months, data.levels.gap);
    expect(result.fromMonth).toBe("1995-01");
    expect(result.result).toBe(40);
  });
});

describe("convertAmountWithLocation", () => {
  it("matches the time-only conversion when both locations are the same", () => {
    const result = convertAmountWithLocation(
      10,
      "1995-01-01",
      "1995-03-01",
      data.months,
      data.levels.a,
      1.2,
      1.2,
    );
    expect(result.result).toBe(40);
    expect(result.timeFactor).toBe(4);
    expect(result.spatialFactor).toBe(1);
  });

  it("multiplies the time factor by the destination-to-origin location ratio", () => {
    const result = convertAmountWithLocation(
      100,
      "1995-01-01",
      "1995-02-01",
      data.months,
      data.levels.a,
      0.8,
      1.2,
    );
    expect(result.timeFactor).toBe(2);
    expect(result.spatialFactor).toBeCloseTo(1.5);
    expect(result.factor).toBeCloseTo(3);
    expect(result.result).toBeCloseTo(300);
  });
});
