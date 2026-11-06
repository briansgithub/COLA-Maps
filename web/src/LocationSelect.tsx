import { useId, useMemo, useState } from "react";
export interface LocationChoice { geoid: string; label: string; }
export function LocationSelect({id, label, value, options, loading, onChange, className = "", searchPlaceholder = "Search metros", emptyLabel = "Search for a place"}: {
  id: string; label: string; value: string; options: LocationChoice[]; loading: boolean;
  onChange: (geoid: string) => void; className?: string; searchPlaceholder?: string; emptyLabel?: string; maxVisible?: number;
}) {
  const listId = useId();
  const selected = options.find(option => option.geoid === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = useMemo(() => options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50), [options, query]);
  const choose = (option: LocationChoice) => { onChange(option.geoid); setOpen(false); setQuery(""); setActive(-1); };
  return <div className={`location-field combobox-field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <div className="combobox">
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && active >= 0 && matches[active] ? `${listId}-${active}` : undefined}
        value={open ? query : selected?.label ?? ""} placeholder={loading ? "Loading places…" : emptyLabel}
        disabled={loading} autoComplete="off" onFocus={() => { setOpen(true); setQuery(""); setActive(-1); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onBlur={() => { setOpen(false); setQuery(""); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            const next = event.key === "ArrowDown" ? Math.min(active + 1, matches.length - 1) : Math.max(active - 1, 0);
            setActive(next);
            requestAnimationFrame(() => document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" }));
          } else if (event.key === "Enter" && open) {
            event.preventDefault(); if (matches[active]) choose(matches[active]);
          } else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(""); }
        }} aria-description={searchPlaceholder} />
      {open && <ul className="combobox-options" id={listId} role="listbox" aria-label={label}>
        {matches.map((option, index) => <li key={option.geoid} id={`${listId}-${index}`} role="option" aria-selected={option.geoid === value}
          className={active === index ? "highlighted" : ""} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>{option.label}</li>)}
        {!matches.length && <li role="presentation">No matching places. Try another name.</li>}
        {matches.length === 50 && <li role="presentation" className="field-note">Type more to narrow the results.</li>}
      </ul>}
    </div>
  </div>;
}
