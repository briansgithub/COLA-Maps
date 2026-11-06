import type { InflationData, SeriesMeta } from "./data";
import { ACRONYMS, BIBLIOGRAPHY, RELIABILITY_NOTES } from "./sourceDocs";
export default function Sources({ data }: { data: InflationData }) {
  const grouped = data.series
    .filter((series) => series.source !== "Calculated from component series")
    .reduce((groups, series) => {
      const group = groups.get(series.group) ?? [];
      group.push(series);
      groups.set(series.group, group);
      return groups;
    }, new Map<string, SeriesMeta[]>());
  return (
    <section className="page sources-page">
      <div className="page-title">
        <h1>Method & sources</h1>
        <p>Acronyms, dataset links, limits, and per-series provenance.</p>
      </div>

      <details className="disclosure method-note">
        <summary>Method</summary>
        <p>{data.meta.method} Sparse months are interpolated; late water/milk series are spliced to related BLS indexes. Spatial coefficients stay cross-sectional at survey vintage and multiply time ratios—they do not replace them. See Data_Notes in the workbook.</p>
      </details>
      <details className="disclosure source-section">
        <summary>Acronyms</summary>
        <dl className="acronym-list">
          {ACRONYMS.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.expansion}</dd>
            </div>
          ))}
        </dl>
      </details>

      <details className="disclosure source-section">
        <summary>Bibliography</summary>
        <ol className="bibliography-list">
          {BIBLIOGRAPHY.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.title}</strong>
              <span>{entry.publisher}</span>
              <a href={entry.url} target="_blank" rel="noreferrer">{entry.url}</a>
              {entry.note && <small>{entry.note}</small>}
            </li>
          ))}
        </ol>
      </details>

      <details className="disclosure source-section">
        <summary>Limits</summary>
        {RELIABILITY_NOTES.map((note) => (
          <article className="reliability-note" key={note.title}>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
          </article>
        ))}
      </details>

      {[...grouped.entries()].map(([group, series]) => (
        <details className="disclosure source-group" key={group}>
          <summary>{group[0].toUpperCase() + group.slice(1)} series</summary>
          {series.map((item: SeriesMeta) => (
            <details key={item.key}>
              <summary>
                <span>{item.label}</span>
                <small>{item.seriesId || "Calculated"}</small>
              </summary>
              <div>
                <p><strong>Source:</strong> {item.source}</p>
                <p><strong>Frequency:</strong> {item.frequency} · <strong>Units:</strong> {item.units}</p>
                {item.note && <p>{item.note}</p>}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">Source ↗</a>}
              </div>
            </details>
          ))}
        </details>
      ))}

    </section>
  );
}
