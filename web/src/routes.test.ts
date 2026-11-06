import { describe, expect, it } from "vitest";
import { resolveRoute } from "./routes";
describe("routes", () => {
  it("opens home for empty and unknown links", () => {
    expect(resolveRoute("")).toBe("home");
    expect(resolveRoute("#unknown")).toBe("home");
    expect(resolveRoute("#constructor")).toBe("home");
  });
  it.each(["home", "convert", "trends", "places", "customize", "sources"])("resolves %s", view => {
    expect(resolveRoute("#" + view)).toBe(view);
  });
  it.each([["converter", "convert"], ["explore", "trends"], ["map", "places"], ["weights", "customize"]])("preserves %s", (old, view) => {
    expect(resolveRoute("#" + old)).toBe(view);
  });
});
