import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultWeights, loadData, monthKey, formatMonth, type InflationData, type CompositeKind, type WeightMap } from "./data";
import { resolveRoute, type View } from "./routes";
const Explore = lazy(() => import("./Trends"));
const MapTab = lazy(() => import("./Places"));
const Converter = lazy(() => import("./Converter"));
const Weights = lazy(() => import("./Customize"));
const Sources = lazy(() => import("./Sources"));
const Home = lazy(() => import("./Home"));
class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <section className="page"><h1>Could not open this tool</h1><p>Check your connection and reload to try again.</p><button className="primary" onClick={() => location.reload()}>Reload app</button></section> : this.props.children;
  }
}
function PageFocus({ view }: { view: View }) {
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  return null;
}
function useWeights(data: InflationData | null, kind: CompositeKind) {
  const storageKey = `inflation-weights-v1-${kind}`;
  const [weights, setWeights] = useState<WeightMap>({});

  useEffect(() => {
    if (!data) return;
    const fallback = defaultWeights(data, kind);
    try {
      const saved = localStorage.getItem(storageKey);
      setWeights(saved ? { ...fallback, ...JSON.parse(saved) } : fallback);
    } catch {
      setWeights(fallback);
    }
  }, [data, kind, storageKey]);

  const save = (next: WeightMap) => {
    setWeights(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const reset = () => {
    if (!data) return;
    const defaults = defaultWeights(data, kind);
    setWeights(defaults);
    localStorage.removeItem(storageKey);
  };
  return { weights, save, reset };
}

function useAnchor(data: InflationData | null) {
  const [anchorDate, setAnchorDateState] = useState("1995-01-20");
  useEffect(() => {
    if (!data) return;
    const saved = localStorage.getItem("inflation-anchor-v1");
    const candidate = saved || data.meta.defaultAnchorDate || data.meta.birthDate;
    const month = monthKey(candidate);
    setAnchorDateState(
      month >= data.meta.firstMonth && month <= data.meta.latestMonth
        ? candidate
        : data.meta.defaultAnchorDate,
    );
  }, [data]);
  const setAnchorDate = (next: string) => {
    setAnchorDateState(next);
    localStorage.setItem("inflation-anchor-v1", next);
  };
  return { anchorDate, setAnchorDate };
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function App() {
  const [data, setData] = useState<InflationData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<View>(() => resolveRoute(location.hash));
  const [more, setMore] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateApp, setUpdateApp] = useState<(() => Promise<void>) | null>(null);
  const cpi = useWeights(data, "composite_cpi");
  const lived = useWeights(data, "composite_lived");
  const anchor = useAnchor(data);

  useEffect(() => {
    loadData().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "The inflation data could not be loaded.");
    });
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<() => Promise<void>>).detail;
      setUpdateApp(() => detail);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("pwa-update", onUpdate);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("pwa-update", onUpdate);
    };
  }, []);

  useEffect(() => {
    const route = () => { setTab(resolveRoute(location.hash)); if (menu.current) menu.current.open = false; };
    const close = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && menu.current) menu.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && menu.current?.open) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } };
    window.addEventListener("hashchange", route);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { window.removeEventListener("hashchange", route); document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const selectTab = (next: View) => {
    setTab(next);
    location.hash = next === "home" ? "" : next;
    if (menu.current) menu.current.open = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (error) {
    return (
      <main className="state-page">
        <p className="eyebrow">Dollar Since 1995</p>
        <h1>Data unavailable</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    );
  }

  if (!data || Object.keys(cpi.weights).length === 0 || Object.keys(lived.weights).length === 0) {
    return (
      <main className="state-page loading">
        <div className="loading-mark">$</div>
        <p>Loading more than a century of prices…</p>
      </main>
    );
  }

  return (
    <>
      <header className="site-header">
        <button className="brand" onClick={() => selectTab("home")} aria-label="Dollar Since 1995 home">
          <span className="brand-mark">$</span>
          <span>Dollar Since <strong>1995</strong></span>
        </button>
        <nav aria-label="Main navigation">
          {(["convert", "trends", "places"] as View[]).map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => selectTab(item)}
              aria-current={tab === item ? "page" : undefined}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <details className="more-wrap" ref={menu} onToggle={event => setMore(event.currentTarget.open)}>
          <summary aria-expanded={more}>More <span aria-hidden="true">⌄</span>{updateApp && <span className="update-dot" />}</summary>
          <div className="more-panel">
            <button onClick={() => selectTab("customize")}>Customize basket</button>
            <button onClick={() => selectTab("sources")}>Method & sources</button>
            {installPrompt ? <button onClick={install}>Install app</button> : <details><summary>Install app</summary><p>Use your browser’s install option. On iPhone, choose Share → Add to Home Screen.</p></details>}
            {updateApp ? <button onClick={() => void updateApp()}>Update available · Update now</button> : <p>App is up to date</p>}
            <p>Prices through {formatMonth(data.meta.latestMonth)}<br />Retrieved {data.meta.retrieved}</p>
          </div>
        </details>
      </header>



      <main>
        <ViewBoundary key={tab}><Suspense fallback={<div className="view-loading" role="status">Opening {tab}…</div>}>
        {tab === "home" && <Home data={data} onNavigate={selectTab} />}
        {tab === "trends" && (
          <Explore
            data={data}
            cpiWeights={cpi.weights}
            livedWeights={lived.weights}
            anchorDate={anchor.anchorDate}
            onAnchorChange={anchor.setAnchorDate}
            onConvert={() => selectTab("convert")}
          />
        )}
        {tab === "places" && <MapTab />}
        {tab === "convert" && (
          <Converter data={data} cpiWeights={cpi.weights} livedWeights={lived.weights} />
        )}
        {tab === "customize" && (
          <Weights
            data={data}
            cpiWeights={cpi.weights}
            livedWeights={lived.weights}
            onSaveCpi={cpi.save}
            onSaveLived={lived.save}
            onResetCpi={cpi.reset}
            onResetLived={lived.reset}
          />
        )}
        {tab === "sources" && <Sources data={data} />}
        <PageFocus view={tab} />
        </Suspense></ViewBoundary>
      </main>

      <footer>
        <p>Through {formatMonth(data.meta.latestMonth)} · Retrieved {data.meta.retrieved}</p>
      </footer>
    </>
  );
}
