import { describe, expect, it } from "vitest";
import { convertAmount, geometricComposite, type InflationData } from "./data";

const data: InflationData = {
  meta: {
    baseMonth: "1995-01",
    birthDate: "1995-01-20",
    retrieved: "2026-11-03",
    latestMonth: "1995-03",
    method: "",
    notes: {},
  },
  months: ["1995-01", "1995-02", "1995-03"],
  series: [],
  coefficients: {
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
});

describe("convertAmount", () => {
  it("converts forward using the coefficient ratio", () => {
    const result = convertAmount(10, "1995-01-20", "1995-03-02", data.months, data.coefficients.a);
    expect(result.result).toBe(40);
    expect(result.factor).toBe(4);
  });

  it("is reversible", () => {
    const forward = convertAmount(10, "1995-01-01", "1995-03-01", data.months, data.coefficients.a);
    const reverse = convertAmount(forward.result, "1995-03-01", "1995-01-01", data.months, data.coefficients.a);
    expect(reverse.result).toBeCloseTo(10);
  });

  it("uses the nearest prior observation when a month is missing", () => {
    const result = convertAmount(10, "1995-02-10", "1995-03-01", data.months, data.coefficients.gap);
    expect(result.fromMonth).toBe("1995-01");
    expect(result.result).toBe(40);
  });
});
