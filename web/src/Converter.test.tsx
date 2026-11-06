import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Converter from "./Converter";
import { convertAmount, defaultWeights, type InflationData } from "./data";
import payload from "../public/data/inflation.json";

describe("initial conversion", () => {
  it("shows an official CPI answer before any locations or advanced options are selected", () => {
    const data = payload as InflationData;
    const html = renderToStaticMarkup(<Converter data={data}
      cpiWeights={defaultWeights(data, "composite_cpi")}
      livedWeights={defaultWeights(data, "composite_lived")} />);
    const expected = convertAmount(100, data.meta.birthDate, data.meta.latestMonth, data.months, data.levels.cpi);
    const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(expected.result);
    expect(html).toContain(`<strong>${formatted}</strong>`);
    expect(html).toMatch(/<option value="cpi" selected=""/);
    expect(html).toContain("+ Add locations");
    expect(html).not.toContain('id="from-location"');
    expect(html).not.toContain('id="to-location"');
    expect(html).not.toContain("<details class=\"disclosure\" open");
  });
});
