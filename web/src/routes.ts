export type View = "home" | "convert" | "trends" | "places" | "customize" | "sources";
const aliases: Record<string, View> = {
  home: "home", convert: "convert", converter: "convert", trends: "trends", explore: "trends",
  places: "places", map: "places", customize: "customize", weights: "customize", sources: "sources",
};
export function resolveRoute(hash: string): View {
  const key = hash.replace(/^#/, "").toLowerCase();
  return Object.hasOwn(aliases, key) ? aliases[key] : "home";
}
