import { convertAmount, formatMonth, type InflationData } from "./data";
import type { View } from "./routes";
const tasks = [
  { view: "convert" as const, title: "Convert dollars across time", description: "See what an amount from the past is worth today.", icon: "⇄", action: "Convert dollars" },
  { view: "trends" as const, title: "View price trends", description: "Explore how everyday costs have changed.", icon: "↗", action: "Explore trends" },
  { view: "places" as const, title: "Compare costs by place", description: "Find where your dollar goes further.", icon: "◎", action: "Explore places" },
];
export default function Home({data, onNavigate}: {data: InflationData; onNavigate: (view: View) => void}) {
  const snapshot = convertAmount(100, "1995-01-20", data.meta.latestMonth, data.months, data.levels.cpi);
  const amount = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(snapshot.result);
  return <section className="page home-page">
    <div className="home-intro"><p className="eyebrow">Make sense of your dollar</p><h1>What do you want to compare?</h1><p>Understand purchasing power across time and place.</p></div>
    <div className="task-cards">{tasks.map(task => <button className="task-card" key={task.view} onClick={() => onNavigate(task.view)}><span className="task-icon" aria-hidden="true">{task.icon}</span><h2>{task.title}</h2><p>{task.description}</p><span className="task-link">{task.action} <span aria-hidden="true">→</span></span></button>)}</div>
    <aside className="home-snapshot"><div><p className="eyebrow">A little perspective</p><h2>$100 in January 1995 ≈ <strong>{amount}</strong> in {formatMonth(snapshot.toMonth)}</h2><p>Based on the official Consumer Price Index (CPI).</p></div><button className="text-button" onClick={() => onNavigate("trends")}>Explore the change →</button></aside>
  </section>;
}
