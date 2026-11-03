"""Build the US dollar inflation coefficient workbook (January 1995 = 1.00).

Downloads (and caches under data/raw/) BLS, FRED, and Economist data, then writes
output/US_Dollar_Inflation_Coefficient.xlsx with live formulas and charts that
survive import into Google Sheets, plus PNG previews.

Re-run with --refresh to ignore the cache and download fresh data.
"""

from __future__ import annotations

import hashlib
import io
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import requests
from openpyxl import Workbook
from openpyxl.chart import LineChart, Reference
from openpyxl.chart.axis import DateAxis
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "output"
WORKBOOK_PATH = OUT_DIR / "US_Dollar_Inflation_Coefficient.xlsx"
WEB_DATA_PATH = ROOT / "web" / "public" / "data" / "inflation.json"
BASE = pd.Timestamp("1995-01-01")
REFRESH = "--refresh" in sys.argv
RETRIEVED = date.today().isoformat()

BLS_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}"
BIG_MAC_URL = "https://raw.githubusercontent.com/TheEconomist/big-mac-data/master/output-data/big-mac-full-index.csv"
USPS_URL = "https://about.usps.com/who/profile/history/domestic-letter-rates-since-1863.htm"
AFBF_URL = "https://www.fb.org/files/Year-Over-Year-Price-Comparison-2024.pdf"
AFBF_2025_URL = "https://www.fb.org/news-release/cost-of-thanksgiving-dinner-declines"
WEIGHTS_URL = "https://www.bls.gov/cpi/tables/relative-importance/2025.htm"

# First-class 1-oz letter, cents, by effective date (USPS rate history).
STAMP_RATES = [
    ("1991-02-03", 29), ("1995-01-01", 32), ("1999-01-10", 33), ("2001-01-07", 34),
    ("2002-06-30", 37), ("2006-01-08", 39), ("2007-05-14", 41), ("2008-05-12", 42),
    ("2009-05-11", 44), ("2012-01-22", 45), ("2013-01-27", 46), ("2014-01-26", 49),
    ("2016-04-10", 47), ("2017-01-22", 49), ("2018-01-21", 50), ("2019-01-27", 55),
    ("2021-08-29", 58), ("2022-07-10", 60), ("2023-01-22", 63), ("2023-07-09", 66),
    ("2024-01-21", 68), ("2024-07-14", 73), ("2025-07-13", 78), ("2026-07-12", 82),
]

# American Farm Bureau classic Thanksgiving dinner for 10, USD (surveyed each November).
AFBF_THANKSGIVING = {
    1994: 28.40, 1995: 29.64, 1996: 31.66, 1997: 31.75, 1998: 33.09, 1999: 33.83,
    2000: 32.37, 2001: 35.04, 2002: 34.56, 2003: 36.28, 2004: 35.68, 2005: 36.78,
    2006: 38.10, 2007: 42.26, 2008: 44.61, 2009: 42.91, 2010: 43.47, 2011: 49.20,
    2012: 49.48, 2013: 49.04, 2014: 49.41, 2015: 50.11, 2016: 49.87, 2017: 49.12,
    2018: 48.90, 2019: 48.91, 2020: 46.90, 2021: 53.31, 2022: 64.05, 2023: 61.17,
    2024: 58.08, 2025: 55.18,
}


@dataclass
class Spec:
    key: str
    label: str
    group: str  # headline | component | splice | price | unorthodox | context
    source: str  # bls | fred | bigmac | stamp | afbf
    sid: str
    units: str
    fmt: str
    frequency: str = "Monthly"
    method: str = "monthly"  # monthly | sparse | step | annual
    trailing_fill: int = 3
    cpi_weight: float | None = None
    lived_weight: float | None = None
    splice_from: str | None = None
    link_to_cpi: bool = False
    note: str = ""


IDX = "0.000"
USD2 = '"$"#,##0.00'
USD3 = '"$"#,##0.000'
USD0 = '"$"#,##0'

SPECS: list[Spec] = [
    Spec("cpi", "CPI-U, all items (official CPI)", "headline", "bls", "CUUR0000SA0", "Index 1982-84=100", IDX),
    Spec("pce", "PCE price index (Fed's preferred gauge)", "headline", "fred", "PCEPI", "Index 2017=100", IDX),
    # Basket components. cpi_weight = BLS CPI-U relative importance, December 2025.
    Spec("food_home", "Groceries (food at home)", "component", "bls", "CUUR0000SAF11", "Index", IDX,
         cpi_weight=8.325, lived_weight=8.325),
    Spec("food_away", "Restaurants (food away from home)", "component", "bls", "CUUR0000SEFV", "Index", IDX,
         cpi_weight=5.373, lived_weight=5.373),
    Spec("rent", "Rent of primary residence", "component", "bls", "CUUR0000SEHA", "Index", IDX,
         cpi_weight=7.840, lived_weight=7.840),
    Spec("oer", "Owners' equivalent rent (CPI's homeowner cost)", "component", "bls", "CUUR0000SEHC", "Index", IDX,
         cpi_weight=26.204, lived_weight=0.0,
         note="CPI measures homeowner housing cost as an imputed rent, not home prices."),
    Spec("home_prices", "Home prices (Case-Shiller national)", "component", "fred", "CSUSHPINSA", "Index Jan 2000=100", IDX,
         cpi_weight=0.0, lived_weight=26.204,
         note="Lived-experience basket uses actual home prices in place of owners' equivalent rent."),
    Spec("electricity", "Electricity", "component", "bls", "CUUR0000SEHF01", "Index", IDX,
         cpi_weight=2.489, lived_weight=2.489),
    Spec("utility_gas", "Natural gas utility service", "component", "bls", "CUUR0000SEHF02", "Index", IDX,
         cpi_weight=0.773, lived_weight=0.773),
    Spec("water", "Water, sewer and trash", "component", "bls", "CUUR0000SEHG", "Index Dec 1997=100", IDX,
         cpi_weight=1.144, lived_weight=1.144, splice_from="water_proxy"),
    Spec("gasoline", "Gasoline", "component", "bls", "CUUR0000SETB01", "Index", IDX,
         cpi_weight=2.895, lived_weight=2.895),
    Spec("auto_ins", "Car insurance", "component", "bls", "CUUR0000SETE", "Index", IDX,
         cpi_weight=2.754, lived_weight=2.754),
    Spec("new_cars", "New vehicles", "component", "bls", "CUUR0000SETA01", "Index", IDX,
         cpi_weight=3.838, lived_weight=3.838,
         note="CPI quality-adjusts vehicles, so this rises much less than sticker prices."),
    Spec("used_cars", "Used cars and trucks", "component", "bls", "CUUR0000SETA02", "Index", IDX,
         cpi_weight=2.759, lived_weight=2.759),
    Spec("medical", "Medical care", "component", "bls", "CUUR0000SAM", "Index", IDX,
         cpi_weight=8.423, lived_weight=8.423),
    Spec("apparel", "Clothing (apparel)", "component", "bls", "CUUR0000SAA", "Index", IDX,
         cpi_weight=2.368, lived_weight=2.368),
    Spec("tuition", "College tuition and fees", "component", "bls", "CUUR0000SEEB01", "Index", IDX,
         cpi_weight=1.351, lived_weight=1.351),
    Spec("furnishings", "Household furnishings and operations", "component", "bls", "CUUR0000SAH3", "Index", IDX,
         cpi_weight=4.298, lived_weight=4.298),
    Spec("car_repair", "Car maintenance and repair", "component", "bls", "CUUR0000SETD", "Index", IDX,
         cpi_weight=1.039, lived_weight=1.039),
    Spec("public_transit", "Public transportation (incl. airfare)", "component", "bls", "CUUR0000SETG", "Index", IDX,
         cpi_weight=1.485, lived_weight=1.485),
    Spec("recreation", "Recreation", "component", "bls", "CUUR0000SAR", "Index Dec 1997=100", IDX,
         cpi_weight=5.137, lived_weight=5.137,
         note="Includes TVs and electronics, which CPI records as getting much cheaper."),
    Spec("communication", "Phone, internet and postage (communication)", "component", "bls", "CUUR0000SAE2",
         "Index Dec 1997=100", IDX, cpi_weight=3.244, lived_weight=3.244,
         note="Falls over time because CPI quality-adjusts phones, computers, and internet service."),
    Spec("personal_care", "Personal care", "component", "bls", "CUUR0000SAG1", "Index", IDX,
         cpi_weight=2.456, lived_weight=2.456),
    Spec("alcohol", "Alcoholic beverages", "component", "bls", "CUUR0000SAF116", "Index", IDX,
         cpi_weight=0.840, lived_weight=0.840),
    Spec("tobacco", "Tobacco and smoking products", "component", "bls", "CUUR0000SEGA", "Index", IDX,
         cpi_weight=0.445, lived_weight=0.445, note="Set to 0 if you don't smoke; taxes drove large increases."),
    # Proxies used only to extend late-starting series back to January 1995.
    Spec("water_proxy", "Water and sewerage maintenance (splice proxy)", "splice", "bls", "CUUR0000SEHG01", "Index", IDX),
    Spec("dairy_proxy", "Dairy and related products (splice proxy)", "splice", "bls", "CUUR0000SEFJ", "Index", IDX),
    # Actual average shelf prices (BLS Average Price Data).
    Spec("eggs", "Eggs, grade A large, per dozen", "price", "bls", "APU0000708111", "USD per dozen", USD3),
    Spec("milk", "Whole milk, per gallon", "price", "bls", "APU0000709112", "USD per gallon", USD3,
         splice_from="dairy_proxy"),
    Spec("bread", "White bread, per lb", "price", "bls", "APU0000702111", "USD per lb", USD3),
    Spec("ground_beef", "Ground beef (100% beef), per lb", "price", "bls", "APU0000703112", "USD per lb", USD3),
    Spec("chicken", "Whole chicken, per lb", "price", "bls", "APU0000706111", "USD per lb", USD3),
    Spec("bananas", "Bananas, per lb", "price", "bls", "APU0000711211", "USD per lb", USD3),
    Spec("elec_kwh", "Electricity, per kWh", "price", "bls", "APU000072610", "USD per kWh", USD3),
    Spec("gas_gallon", "Regular gasoline, per gallon", "price", "bls", "APU000074714", "USD per gallon", USD3),
    Spec("natgas_therm", "Utility natural gas, per therm", "price", "bls", "APU000072620", "USD per therm", USD3),
    # Unorthodox cross-checks.
    Spec("big_mac", "Big Mac (US price)", "unorthodox", "bigmac", "big-mac-full-index.csv (USA local_price)",
         "USD", USD2, frequency="Semiannual (since Apr 2000)", method="sparse", trailing_fill=6, link_to_cpi=True,
         note="Economist dataset starts Apr 2000; coefficient is linked to CPI-U at that date."),
    Spec("stamp", "First-class postage stamp", "unorthodox", "stamp", "USPS domestic letter rates", "USD", USD2,
         frequency="On rate change", method="step", trailing_fill=0),
    Spec("thanksgiving", "Thanksgiving dinner for 10 (Farm Bureau)", "unorthodox", "afbf", "AFBF classic menu",
         "USD", USD2, frequency="Annual (November)", method="annual", trailing_fill=0),
    # Context: incomes and asset prices.
    Spec("wages", "Hourly wages (production and nonsupervisory)", "context", "fred", "AHETPI", "USD per hour", USD2),
    Spec("median_home", "Median sale price of new and existing homes sold", "context", "fred", "MSPUS", "USD", USD0,
         frequency="Quarterly", method="sparse"),
]
BY_KEY = {s.key: s for s in SPECS}


def fetch_bls(ids: list[str]) -> dict[str, pd.Series]:
    """BLS API v1 allows 25 series and 10 years per request (and 25 requests per day without a key)."""
    if len(ids) > 25:
        out: dict[str, pd.Series] = {}
        for i in range(0, len(ids), 25):
            out.update(fetch_bls(ids[i:i + 25]))
        return out
    windows = [(1995, 2004), (2005, 2014), (2015, 2024), (2025, date.today().year)]
    label = hashlib.md5(",".join(sorted(ids)).encode()).hexdigest()[:10]
    points: dict[str, dict[pd.Timestamp, float]] = {sid: {} for sid in ids}
    for y0, y1 in windows:
        cache = RAW_DIR / f"bls_{label}_{y0}_{y1}.json"
        if cache.exists() and not REFRESH:
            payload = json.loads(cache.read_text())
        else:
            r = requests.post(BLS_URL, json={"seriesid": ids, "startyear": str(y0), "endyear": str(y1)}, timeout=120)
            r.raise_for_status()
            payload = r.json()
            if payload.get("status") != "REQUEST_SUCCEEDED":
                raise RuntimeError(f"BLS request failed: {payload.get('message')}")
            cache.write_text(json.dumps(payload))
        for series in payload["Results"]["series"]:
            for obs in series["data"]:
                if not obs["period"].startswith("M") or obs["period"] == "M13":
                    continue
                try:
                    value = float(obs["value"])
                except ValueError:
                    continue
                month = pd.Timestamp(int(obs["year"]), int(obs["period"][1:]), 1)
                points[series["seriesID"]][month] = value
    return {sid: pd.Series(p, dtype=float).sort_index() for sid, p in points.items()}


def fetch_fred(sid: str) -> pd.Series:
    cache = RAW_DIR / f"fred_{sid}.csv"
    if cache.exists() and not REFRESH:
        text = cache.read_text()
    else:
        r = requests.get(FRED_URL.format(sid=sid), timeout=120)
        r.raise_for_status()
        text = r.text
        cache.write_text(text)
    df = pd.read_csv(io.StringIO(text))
    df.columns = ["date", "value"]
    s = pd.Series(pd.to_numeric(df["value"], errors="coerce").values, index=pd.to_datetime(df["date"]))
    return s.dropna()


def fetch_big_mac() -> pd.Series:
    cache = RAW_DIR / "big_mac_full_index.csv"
    if cache.exists() and not REFRESH:
        text = cache.read_text()
    else:
        r = requests.get(BIG_MAC_URL, timeout=120)
        r.raise_for_status()
        text = r.text
        cache.write_text(text)
    df = pd.read_csv(io.StringIO(text))
    us = df[df["iso_a3"] == "USA"]
    months = pd.to_datetime(us["date"]).dt.to_period("M").dt.to_timestamp()
    return pd.Series(us["local_price"].values, index=months).groupby(level=0).last().sort_index()


def month_ranges(months: list[pd.Timestamp]) -> str:
    if not months:
        return ""
    months = sorted(months)
    ranges, start, prev = [], months[0], months[0]
    for m in months[1:]:
        if m == prev + pd.offsets.MonthBegin(1):
            prev = m
            continue
        ranges.append((start, prev))
        start = prev = m
    ranges.append((start, prev))
    return ", ".join(a.strftime("%b %Y") if a == b else f"{a:%b %Y}-{b:%b %Y}" for a, b in ranges)


def to_monthly(spec: Spec, raw: pd.Series, idx: pd.DatetimeIndex) -> tuple[pd.Series, dict[str, list]]:
    """Return a monthly series on idx plus notes on which months were not directly observed."""
    notes: dict[str, list] = {"interpolated": [], "carried_forward": []}
    if spec.method == "step":
        changes = pd.Series([v / 100 for _, v in STAMP_RATES], index=pd.to_datetime([d for d, _ in STAMP_RATES]))
        values = [changes[changes.index <= m + pd.Timedelta(days=14)].iloc[-1] for m in idx]
        return pd.Series(values, index=idx), notes

    full_index = idx.union(raw.index)
    s = raw.reindex(full_index)
    observed = s.notna()
    method = "time" if spec.method in ("sparse", "annual") else "linear"
    filled = s.interpolate(method=method, limit_area="inside")
    if spec.trailing_fill:
        filled = filled.ffill(limit=spec.trailing_fill)
    filled = filled.reindex(idx)
    observed = observed.reindex(idx, fill_value=False)
    last_obs = raw.index.max()
    for m in idx[filled.notna() & ~observed]:
        notes["carried_forward" if m > last_obs else "interpolated"].append(m)
    return filled, notes


def build_monthly() -> tuple[pd.DataFrame, dict[str, dict[str, list]], dict[str, tuple]]:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    bls_cpi = [s.sid for s in SPECS if s.source == "bls" and not s.sid.startswith("APU")]
    bls_apu = [s.sid for s in SPECS if s.source == "bls" and s.sid.startswith("APU")]
    raw: dict[str, pd.Series] = {}
    raw.update(fetch_bls(bls_cpi))
    raw.update(fetch_bls(bls_apu))
    for s in SPECS:
        if s.source == "fred":
            raw[s.sid] = fetch_fred(s.sid)
    raw["bigmac"] = fetch_big_mac()
    raw["afbf"] = pd.Series({pd.Timestamp(y, 11, 1): v for y, v in AFBF_THANKSGIVING.items()})
    raw["stamp"] = pd.Series(dtype=float, index=pd.DatetimeIndex([]))

    cpi = raw["CUUR0000SA0"]
    end = cpi[cpi.index >= BASE].index.max()
    idx = pd.date_range(BASE, end, freq="MS")

    monthly, notes, coverage = {}, {}, {}
    for spec in SPECS:
        series_raw = raw[spec.sid] if spec.source in ("bls", "fred") else raw[spec.source]
        in_window = series_raw[(series_raw.index >= BASE - pd.DateOffset(months=3)) & (series_raw.index <= end)]
        coverage[spec.key] = (
            (in_window.index.min(), in_window.index.max()) if len(in_window) else (BASE, end)
        )
        monthly[spec.key], notes[spec.key] = to_monthly(spec, series_raw, idx)
        notes[spec.key]["spliced"] = []

    for spec in SPECS:
        if not spec.splice_from:
            continue
        s, proxy = monthly[spec.key], monthly[spec.splice_from]
        first = s.first_valid_index()
        if first is None or first <= BASE:
            continue
        missing = s.index[s.index < first]
        s.loc[missing] = s[first] * proxy[missing] / proxy[first]
        notes[spec.key]["spliced"] = list(missing)

    df = pd.DataFrame(monthly, index=idx)
    for spec in SPECS:
        if spec.group in ("headline", "component", "price", "splice") and df[spec.key].isna().any():
            gaps = month_ranges(list(df.index[df[spec.key].isna()]))
            raise RuntimeError(f"{spec.key} still has gaps: {gaps}")
    return df, notes, coverage


def compute_coefficients(df: pd.DataFrame) -> pd.DataFrame:
    """Python mirror of the workbook formulas, used for previews and verification."""
    coef = pd.DataFrame(index=df.index)
    for spec in SPECS:
        if spec.group == "splice":
            continue
        s = df[spec.key]
        if spec.link_to_cpi:
            first = s.first_valid_index()
            coef[spec.key] = s / s[first] * (df["cpi"][first] / df["cpi"].iloc[0])
        else:
            coef[spec.key] = s / s.iloc[0]
    comps = [s for s in SPECS if s.group == "component"]
    for name, attr in (("composite_cpi", "cpi_weight"), ("composite_lived", "lived_weight")):
        w = pd.Series({s.key: getattr(s, attr) for s in comps})
        coef[name] = np.exp(np.log(coef[w.index]).mul(w, axis=1).sum(axis=1) / w.sum())
    coef["real_wage"] = coef["wages"] / coef["cpi"]
    return coef


# ---------------------------------------------------------------- workbook

TITLE = Font(bold=True, size=16)
H2 = Font(bold=True, size=12)
BOLD = Font(bold=True)
HEADER_FILL = PatternFill("solid", fgColor="1F3864")
HEADER_FONT = Font(bold=True, color="FFFFFF")
GROUP_FILL = PatternFill("solid", fgColor="D9E1F2")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
IMPUTED_FONT = Font(italic=True, color="808080")
NOTE_FONT = Font(italic=True, color="595959")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")

COEF_FIRST_ROW = 5
GROUP_TITLES = {
    "headline": "Official headline measures",
    "composite": "Composite baskets (formula-driven; edit weights on the Weights sheet)",
    "component": "CPI categories (basket components)",
    "price": "Actual shelf prices (BLS average prices)",
    "unorthodox": "Unorthodox cross-checks",
    "context": "Income and asset context (not part of the baskets)",
}


def style_header(row) -> None:
    for cell in row:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")


def source_url(spec: Spec) -> str:
    return {
        "bls": f"https://data.bls.gov/timeseries/{spec.sid}",
        "fred": f"https://fred.stlouisfed.org/series/{spec.sid}",
        "bigmac": BIG_MAC_URL,
        "stamp": USPS_URL,
        "afbf": f"{AFBF_URL} ; 2025: {AFBF_2025_URL}",
    }[spec.source]


def source_name(spec: Spec) -> str:
    if spec.source == "bls":
        return "U.S. Bureau of Labor Statistics (API v1)"
    if spec.source == "fred":
        origin = {"PCEPI": "BEA", "CSUSHPINSA": "S&P Cotality Case-Shiller", "MSPUS": "Census/HUD", "AHETPI": "BLS"}
        return f"FRED, St. Louis Fed (originally {origin.get(spec.sid, 'agency')})"
    return {"bigmac": "The Economist, Big Mac Index (GitHub)", "stamp": "U.S. Postal Service",
            "afbf": "American Farm Bureau Federation"}[spec.source]


def export_web_data(df: pd.DataFrame, coef: pd.DataFrame, notes: dict) -> None:
    """Write the compact, public data contract consumed by the static PWA."""
    web_series = []
    for spec in SPECS:
        if spec.group == "splice":
            continue
        web_series.append({
            "key": spec.key,
            "label": spec.label,
            "group": spec.group,
            "source": source_name(spec),
            "seriesId": spec.sid,
            "url": source_url(spec),
            "units": spec.units,
            "frequency": spec.frequency,
            "note": spec.note,
            "cpiWeight": spec.cpi_weight,
            "livedWeight": spec.lived_weight,
        })

    web_series.extend([
        {
            "key": "composite_cpi", "label": "CPI-style basket", "group": "composite",
            "source": "Calculated from component series", "seriesId": "", "url": "",
            "units": "Coefficient", "frequency": "Monthly",
            "note": "Weighted geometric mean using BLS December 2025 spending shares.",
            "cpiWeight": None, "livedWeight": None,
        },
        {
            "key": "composite_lived", "label": "Lived-experience basket", "group": "composite",
            "source": "Calculated from component series", "seriesId": "", "url": "",
            "units": "Coefficient", "frequency": "Monthly",
            "note": "CPI-style basket with actual Case-Shiller home prices replacing owners' equivalent rent.",
            "cpiWeight": None, "livedWeight": None,
        },
        {
            "key": "real_wage", "label": "Real wage (wages / CPI-U)", "group": "context",
            "source": "Calculated from AHETPI and CPI-U", "seriesId": "", "url": "",
            "units": "Coefficient", "frequency": "Monthly", "note": "",
            "cpiWeight": None, "livedWeight": None,
        },
    ])

    coefficient_keys = [s["key"] for s in web_series]
    payload = {
        "meta": {
            "baseMonth": BASE.strftime("%Y-%m"),
            "birthDate": "1995-01-20",
            "retrieved": RETRIEVED,
            "latestMonth": df.index[-1].strftime("%Y-%m"),
            "method": "All coefficients are normalized to January 1995 = 1.00.",
            "notes": {
                spec.key: {
                    "interpolated": len(notes[spec.key]["interpolated"]),
                    "carriedForward": len(notes[spec.key]["carried_forward"]),
                    "spliced": month_ranges(notes[spec.key]["spliced"]),
                }
                for spec in SPECS
                if spec.group != "splice" and any(notes[spec.key].values())
            },
        },
        "series": web_series,
        "months": [month.strftime("%Y-%m") for month in df.index],
        "coefficients": {
            key: [None if pd.isna(value) else round(float(value), 8) for value in coef[key]]
            for key in coefficient_keys
        },
    }
    WEB_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    WEB_DATA_PATH.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def add_line_chart(ws_target, anchor: str, title: str, ws_data, date_col: int, cols: list[int],
                   last_row: int, width: float = 30, height: float = 14) -> None:
    chart = LineChart()
    chart.title = title
    chart.style = 2
    chart.width, chart.height = width, height
    chart.y_axis.title = "Coefficient (Jan 1995 = 1.00)"
    chart.y_axis.number_format = "0.0"
    chart.y_axis.majorGridlines = chart.y_axis.majorGridlines
    chart.x_axis = DateAxis(crossAx=100)
    chart.x_axis.number_format = "yyyy"
    chart.x_axis.majorTimeUnit = "years"
    chart.x_axis.majorUnit = 2
    chart.x_axis.title = None
    chart.x_axis.delete = False
    chart.y_axis.delete = False
    chart.legend.position = "b"
    chart.display_blanks = "gap"
    for c in cols:
        chart.add_data(Reference(ws_data, min_col=c, min_row=COEF_FIRST_ROW - 1, max_row=last_row), titles_from_data=True)
    chart.set_categories(Reference(ws_data, min_col=date_col, min_row=COEF_FIRST_ROW, max_row=last_row))
    for s in chart.series:
        s.smooth = False
        s.marker.symbol = "none"
        s.graphicalProperties.line.width = 22000
    ws_target.add_chart(chart, anchor)


def build_workbook(df: pd.DataFrame, notes: dict, coverage: dict) -> None:
    wb = Workbook()
    ws_dash = wb.active
    ws_dash.title = "Dashboard"
    ws_charts = wb.create_sheet("Charts")
    ws_w = wb.create_sheet("Weights")
    ws_c = wb.create_sheet("Coefficients")
    ws_r = wb.create_sheet("Raw_Data")
    ws_s = wb.create_sheet("Sources")
    ws_n = wb.create_sheet("Data_Notes")

    n = len(df)
    last_row_raw = n + 1
    last_row_coef = COEF_FIRST_ROW + n - 1

    # Raw_Data: one row per month, values as downloaded (imputed months in grey italics).
    ws_r["A1"] = "Month"
    raw_col: dict[str, int] = {}
    for i, spec in enumerate(SPECS, start=2):
        raw_col[spec.key] = i
        ws_r.cell(row=1, column=i, value=f"{spec.label} [{spec.units}]")
    style_header(ws_r[1])
    for r, (month, values) in enumerate(df.iterrows(), start=2):
        ws_r.cell(row=r, column=1, value=month.to_pydatetime()).number_format = "mmm yyyy"
        for spec in SPECS:
            v = values[spec.key]
            if pd.isna(v):
                continue
            cell = ws_r.cell(row=r, column=raw_col[spec.key], value=float(v))
            cell.number_format = spec.fmt
            imputed = notes[spec.key]
            if month in imputed["interpolated"] or month in imputed["carried_forward"] or month in imputed["spliced"]:
                cell.font = IMPUTED_FONT
    ws_r.freeze_panes = "B2"
    ws_r.column_dimensions["A"].width = 11
    for i in range(2, len(SPECS) + 2):
        ws_r.column_dimensions[get_column_letter(i)].width = 16
    ws_r.row_dimensions[1].height = 60

    # Coefficients layout.
    headline = [s for s in SPECS if s.group == "headline"]
    components = [s for s in SPECS if s.group == "component"]
    prices = [s for s in SPECS if s.group == "price"]
    unorthodox = [s for s in SPECS if s.group == "unorthodox"]
    context = [s for s in SPECS if s.group == "context"]

    columns: list[tuple[str, str, str]] = []  # (key, header, group)
    columns += [(s.key, s.label, "headline") for s in headline]
    columns += [("composite_cpi", "Composite: CPI-style basket", "composite"),
                ("composite_lived", "Composite: lived-experience basket", "composite")]
    columns += [(s.key, s.label, "component") for s in components]
    columns += [(s.key, s.label, "price") for s in prices]
    columns += [(s.key, s.label + (" (linked to CPI-U at Apr 2000)" if s.link_to_cpi else ""), "unorthodox")
                for s in unorthodox]
    columns += [(s.key, s.label, "context") for s in context]
    columns += [("real_wage", "Real wage (hourly wages / CPI-U)", "context")]
    coef_col = {key: i for i, (key, _, _) in enumerate(columns, start=2)}

    ws_c["A1"] = "Inflation coefficients: value in each month / value in January 1995"
    ws_c["A1"].font = H2
    ws_c["A2"] = "Weight: CPI-style"
    ws_c["A3"] = "Weight: lived-experience"
    for cell in (ws_c["A2"], ws_c["A3"]):
        cell.font = BOLD
    ws_c.cell(row=4, column=1, value="Month")
    for key, header, group in columns:
        ws_c.cell(row=4, column=coef_col[key], value=header)
    style_header(ws_c[4])
    ws_c.row_dimensions[4].height = 75

    weights_first_row = 6
    weight_row = {s.key: weights_first_row + i for i, s in enumerate(components)}
    for s in components:
        c = coef_col[s.key]
        ws_c.cell(row=2, column=c, value=f"=Weights!D{weight_row[s.key]}").fill = INPUT_FILL
        ws_c.cell(row=3, column=c, value=f"=Weights!E{weight_row[s.key]}").fill = INPUT_FILL
    comp_cols = [coef_col[s.key] for s in components]
    assert comp_cols == list(range(comp_cols[0], comp_cols[-1] + 1)), "components must be contiguous"
    c0, c1 = get_column_letter(comp_cols[0]), get_column_letter(comp_cols[-1])

    base_raw_row = 2
    for i in range(n):
        r = COEF_FIRST_ROW + i
        raw_r = 2 + i
        ws_c.cell(row=r, column=1, value=f"=Raw_Data!A{raw_r}").number_format = "mmm yyyy"
        for key, _, group in columns:
            c = coef_col[key]
            col = get_column_letter(c)
            if key in ("composite_cpi", "composite_lived"):
                wr = 2 if key == "composite_cpi" else 3
                formula = f"=EXP(SUMPRODUCT(${c0}${wr}:${c1}${wr},LN({c0}{r}:{c1}{r}))/SUM(${c0}${wr}:${c1}${wr}))"
            elif key == "real_wage":
                formula = f"={get_column_letter(coef_col['wages'])}{r}/{get_column_letter(coef_col['cpi'])}{r}"
            else:
                spec = BY_KEY[key]
                if pd.isna(df[key].iloc[i]):
                    continue
                rc = get_column_letter(raw_col[key])
                if spec.link_to_cpi:
                    first_i = df.index.get_loc(df[key].first_valid_index())
                    anchor_raw = 2 + first_i
                    anchor_coef = COEF_FIRST_ROW + first_i
                    cpi_letter = get_column_letter(coef_col["cpi"])
                    formula = f"=Raw_Data!{rc}{raw_r}/Raw_Data!{rc}${anchor_raw}*${cpi_letter}${anchor_coef}"
                else:
                    formula = f"=Raw_Data!{rc}{raw_r}/Raw_Data!{rc}${base_raw_row}"
            ws_c.cell(row=r, column=c, value=formula).number_format = "0.000"
    ws_c.freeze_panes = ws_c.cell(row=COEF_FIRST_ROW, column=2)
    ws_c.column_dimensions["A"].width = 24
    for key, _, _ in columns:
        ws_c.column_dimensions[get_column_letter(coef_col[key])].width = 14

    # Weights sheet.
    ws_w["A1"] = "Basket weights"
    ws_w["A1"].font = TITLE
    ws_w["A2"] = ("Edit the yellow cells to match your own spending (dollars per month, percentages, anything "
                  "proportional; they don't need to add up to 100). Both composites recalculate automatically.")
    ws_w["A3"] = ("Defaults: BLS CPI-U relative importance, December 2025 (share of the average urban household's "
                  "spending). The lived-experience basket swaps CPI's owners' equivalent rent for actual home prices.")
    ws_w["A4"] = WEIGHTS_URL
    for cell in (ws_w["A2"], ws_w["A3"], ws_w["A4"]):
        cell.font = NOTE_FONT
    headers = ["Category", "Series used", "BLS relative importance, Dec 2025 (%)",
               "Weight: CPI-style basket", "Weight: lived-experience basket", "Notes"]
    for c, h in enumerate(headers, start=1):
        ws_w.cell(row=5, column=c, value=h)
    style_header(ws_w[5])
    for s in components:
        r = weight_row[s.key]
        ws_w.cell(row=r, column=1, value=s.label)
        ws_w.cell(row=r, column=2, value=s.sid)
        ws_w.cell(row=r, column=3, value=s.cpi_weight if s.key != "home_prices" else None)
        if s.key == "home_prices":
            ws_w.cell(row=r, column=3, value="n/a (not in CPI)")
        for c, v in ((4, s.cpi_weight), (5, s.lived_weight)):
            cell = ws_w.cell(row=r, column=c, value=v)
            cell.fill = INPUT_FILL
            cell.number_format = "0.000"
        ws_w.cell(row=r, column=6, value=s.note)
        for c in range(1, 7):
            ws_w.cell(row=r, column=c).border = BOX
    total_r = weights_first_row + len(components)
    ws_w.cell(row=total_r, column=1, value="Total").font = BOLD
    for c in (4, 5):
        L = get_column_letter(c)
        ws_w.cell(row=total_r, column=c, value=f"=SUM({L}{weights_first_row}:{L}{total_r - 1})").font = BOLD
    ws_w.cell(row=total_r + 2, column=1,
              value=("Formula: composite = EXP( sum(weight x LN(category coefficient)) / sum(weights) ), a weighted "
                     "geometric mean that holds spending shares constant. With the default CPI-style weights it "
                     "reproduces the official CPI-U to within about 2% across 1995-2026, which validates the method. "
                     "The listed categories cover about 97% of CPI spending; the rest (hotels, renters' insurance, "
                     "vehicle fees, K-12 tuition and childcare, misc. services) is spread proportionally."
                     )).font = NOTE_FONT
    for col, w in zip("ABCDEF", (44, 18, 18, 16, 18, 70)):
        ws_w.column_dimensions[col].width = w
    ws_w.row_dimensions[5].height = 45

    # Dashboard.
    ws_dash["A1"] = "US dollar inflation coefficient since January 1995"
    ws_dash["A1"].font = TITLE
    ws_dash["A2"] = ("Coefficient = price in that month / price in January 1995. A value of 2.24 means something that "
                     "cost $1.00 in January 1995 costs $2.24. Equivalently, a 1995 dollar is worth 1/2.24 = $0.45 today.")
    ws_dash["A2"].font = NOTE_FONT
    ws_dash["A3"] = f"Data retrieved {RETRIEVED}. Latest month with complete CPI data: {df.index[-1]:%B %Y}."
    ws_dash["A3"].font = NOTE_FONT
    dash_headers = ["Measure", "Latest month", "Coefficient", "Avg. annual rate", "$1.00 of Jan 1995 =",
                    "1995 dollar worth today"]
    hdr_row = 5
    for c, h in enumerate(dash_headers, start=1):
        ws_dash.cell(row=hdr_row, column=c, value=h)
    style_header(ws_dash[hdr_row])
    r = hdr_row + 1
    last_group = None
    for key, header, group in columns:
        if group != last_group:
            cell = ws_dash.cell(row=r, column=1, value=GROUP_TITLES.get(group, group))
            cell.font = BOLD
            for c in range(1, 7):
                ws_dash.cell(row=r, column=c).fill = GROUP_FILL
            r += 1
            last_group = group
        if key in ("composite_cpi", "composite_lived", "real_wage"):
            series_last_i = n - 1
        else:
            series_last_i = df.index.get_loc(df[key].last_valid_index())
        cr = COEF_FIRST_ROW + series_last_i
        L = get_column_letter(coef_col[key])
        ws_dash.cell(row=r, column=1, value=header)
        ws_dash.cell(row=r, column=2, value=f"=Coefficients!A{cr}").number_format = "mmm yyyy"
        ws_dash.cell(row=r, column=3, value=f"=Coefficients!{L}{cr}").number_format = '0.00"x"'
        ws_dash.cell(row=r, column=4, value=f"=C{r}^(1/YEARFRAC(DATE(1995,1,1),B{r}))-1").number_format = "0.0%"
        ws_dash.cell(row=r, column=5, value=f"=C{r}").number_format = USD2
        ws_dash.cell(row=r, column=6, value=f"=1/C{r}").number_format = USD2
        if key == "real_wage":
            ws_dash.cell(row=r, column=5, value="n/a")
            ws_dash.cell(row=r, column=6, value="n/a")
        if group == "composite" or key == "cpi":
            for c in range(1, 7):
                ws_dash.cell(row=r, column=c).font = BOLD
        for c in range(1, 7):
            ws_dash.cell(row=r, column=c).border = BOX
        r += 1
    ws_dash.cell(row=r + 1, column=1,
                 value=("Grey italic cells on Raw_Data are interpolated, carried forward, or spliced; see Data_Notes. "
                        "Avg. annual rate is the compound yearly rate implied by the coefficient.")).font = NOTE_FONT
    for col, w in zip("ABCDEF", (52, 12, 12, 12, 14, 14)):
        ws_dash.column_dimensions[col].width = w
    ws_dash.row_dimensions[hdr_row].height = 32
    ws_dash.freeze_panes = "A6"

    cc = lambda *keys: [coef_col[k] for k in keys]  # noqa: E731
    add_line_chart(ws_dash, "H5", "Dollar inflation coefficient since January 1995", ws_c, 1,
                   cc("cpi", "pce", "composite_cpi", "composite_lived"), last_row_coef, width=32, height=17)

    chart_specs = [
        ("Everyday essentials", cc("cpi", "food_home", "food_away", "rent", "electricity", "utility_gas", "water",
                                   "gasoline")),
        ("Big-ticket items and services", cc("cpi", "home_prices", "oer", "medical", "auto_ins", "tuition",
                                             "new_cars", "used_cars", "apparel", "furnishings")),
        ("Other spending", cc("cpi", "recreation", "communication", "personal_care", "alcohol", "public_transit",
                              "car_repair", "tobacco")),
        ("Actual shelf prices (BLS average prices)", cc("cpi", "eggs", "milk", "bread", "ground_beef", "chicken",
                                                       "bananas", "elec_kwh", "gas_gallon", "natgas_therm")),
        ("Unorthodox cross-checks", cc("cpi", "composite_lived", "big_mac", "stamp", "thanksgiving")),
        ("Wages vs prices vs housing", cc("cpi", "composite_lived", "wages", "home_prices", "median_home",
                                          "real_wage")),
    ]
    ws_charts["A1"] = "Category charts (all series: January 1995 = 1.00; CPI-U shown on each for reference)"
    ws_charts["A1"].font = H2
    for i, (title, cols) in enumerate(chart_specs):
        add_line_chart(ws_charts, f"A{3 + i * 30}", title, ws_c, 1, cols, last_row_coef, width=32, height=14.5)

    # Sources.
    src_headers = ["Measure", "Group", "Source", "Series ID", "URL", "Units", "Frequency", "Observed range used",
                   "Notes"]
    for c, h in enumerate(src_headers, start=1):
        ws_s.cell(row=1, column=c, value=h)
    style_header(ws_s[1])
    for r, spec in enumerate(SPECS, start=2):
        lo, hi = coverage[spec.key]
        vals = [spec.label, spec.group, source_name(spec), spec.sid, source_url(spec), spec.units, spec.frequency,
                f"{lo:%b %Y} - {hi:%b %Y}" if spec.method != "step" else "Jan 1995 - present", spec.note]
        for c, v in enumerate(vals, start=1):
            cell = ws_s.cell(row=r, column=c, value=v)
            cell.alignment = WRAP
            cell.border = BOX
    extra = len(SPECS) + 3
    ws_s.cell(row=extra, column=1, value="Basket weights").font = BOLD
    ws_s.cell(row=extra, column=5, value=WEIGHTS_URL)
    ws_s.cell(row=extra + 1, column=1, value=f"All data retrieved {RETRIEVED}.").font = NOTE_FONT
    for col, w in zip("ABCDEFGHI", (40, 11, 30, 22, 50, 18, 16, 20, 60)):
        ws_s.column_dimensions[col].width = w
    ws_s.freeze_panes = "B2"

    # Data notes.
    ws_n["A1"] = "Data treatment"
    ws_n["A1"].font = TITLE
    general = [
        "Base month is January 1995 (birth date 1/20/1995); every coefficient equals 1.00 there.",
        "Index values are not seasonally adjusted, matching the official CPI-U used for cost-of-living adjustments.",
        "Single missing months (e.g. the October 2025 federal shutdown gap) are filled by straight-line interpolation.",
        "Series published with a lag (Case-Shiller, median home price) carry their last value forward up to 3 months.",
        "Late-starting series are extended back to January 1995 by splicing (scaling) onto a closely related index.",
        "Big Mac data begins April 2000, so its coefficient is linked to CPI-U at that date: "
        "coefficient = CPI-U coefficient (Apr 2000) x Big Mac price / Big Mac price (Apr 2000).",
        "Stamp price is the 1-oz first-class rate in effect mid-month. Thanksgiving survey points are each November, "
        "interpolated between years (Jan 1995 is between Nov 1994 and Nov 1995).",
        "Eggs are highly volatile (avian flu outbreaks in 2015, 2022-2025); read their spikes as shocks, not trend.",
    ]
    for i, line in enumerate(general, start=3):
        ws_n.cell(row=i, column=1, value=f"- {line}")
    start = len(general) + 4
    for c, h in enumerate(["Measure", "Interpolated months", "Carried-forward months", "Spliced months (source)"],
                          start=1):
        ws_n.cell(row=start, column=c, value=h)
    style_header(ws_n[start])
    r = start + 1
    for spec in SPECS:
        nt = notes[spec.key]
        if not (nt["interpolated"] or nt["carried_forward"] or nt["spliced"]):
            continue
        spliced = month_ranges(nt["spliced"])
        if spliced:
            spliced += f" (scaled to {BY_KEY[spec.splice_from].label})"
        interp = month_ranges(nt["interpolated"])
        if spec.method in ("sparse", "annual") and len(nt["interpolated"]) > 6:
            interp = f"{len(nt['interpolated'])} months between survey dates"
        vals = [spec.label, interp, month_ranges(nt["carried_forward"]), spliced]
        for c, v in enumerate(vals, start=1):
            cell = ws_n.cell(row=r, column=c, value=v)
            cell.alignment = WRAP
            cell.border = BOX
        r += 1
    for col, w in zip("ABCD", (45, 45, 30, 60)):
        ws_n.column_dimensions[col].width = w

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    wb.save(WORKBOOK_PATH)


def save_previews(coef: pd.DataFrame) -> None:
    labels = {"composite_cpi": "Composite: CPI-style basket", "composite_lived": "Composite: lived-experience basket",
              "real_wage": "Real wage"}
    labels.update({s.key: s.label for s in SPECS})

    fig, ax = plt.subplots(figsize=(12, 6.5))
    for key in ("cpi", "pce", "composite_cpi", "composite_lived"):
        ax.plot(coef.index, coef[key], label=labels[key], linewidth=2.2 if "composite" in key else 1.6)
    ax.axhline(1, color="grey", linewidth=0.8)
    ax.set_title("US dollar inflation coefficient since January 1995 (Jan 1995 = 1.00)")
    ax.set_ylabel("Coefficient")
    ax.grid(alpha=0.3)
    ax.legend(loc="upper left")
    for key in ("cpi", "composite_lived"):
        ax.annotate(f"{coef[key].iloc[-1]:.2f}x", (coef.index[-1], coef[key].iloc[-1]), xytext=(5, 0),
                    textcoords="offset points", va="center", fontsize=9)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "preview_main.png", dpi=130)
    plt.close(fig)

    panels = [
        ("Everyday essentials", ["cpi", "food_home", "food_away", "rent", "electricity", "utility_gas", "water",
                                 "gasoline"]),
        ("Big-ticket items and services", ["cpi", "home_prices", "oer", "medical", "auto_ins", "tuition",
                                           "new_cars", "used_cars", "apparel", "furnishings"]),
        ("Other spending", ["cpi", "recreation", "communication", "personal_care", "alcohol", "public_transit",
                            "car_repair", "tobacco"]),
        ("Actual shelf prices", ["cpi", "eggs", "milk", "bread", "ground_beef", "chicken", "bananas", "elec_kwh",
                                 "gas_gallon", "natgas_therm"]),
        ("Unorthodox cross-checks", ["cpi", "composite_lived", "big_mac", "stamp", "thanksgiving"]),
        ("Wages vs prices vs housing", ["cpi", "composite_lived", "wages", "home_prices", "median_home",
                                        "real_wage"]),
    ]
    fig, axes = plt.subplots(3, 2, figsize=(16, 15))
    for ax, (title, keys) in zip(axes.flat, panels):
        for key in keys:
            ax.plot(coef.index, coef[key], label=labels[key], linewidth=2 if key == "cpi" else 1.2,
                    color="black" if key == "cpi" else None)
        ax.set_title(title)
        ax.grid(alpha=0.3)
        ax.legend(fontsize=7, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "preview_categories.png", dpi=110)
    plt.close(fig)


def main() -> None:
    df, notes, coverage = build_monthly()
    coef = compute_coefficients(df)
    export_web_data(df, coef, notes)
    build_workbook(df, notes, coverage)
    save_previews(coef)
    print(f"Months: {df.index[0]:%b %Y} - {df.index[-1]:%b %Y} ({len(df)})")
    for key in ["cpi", "pce", "composite_cpi", "composite_lived"] + [s.key for s in SPECS if s.group not in
                                                                     ("headline", "splice")] + ["real_wage"]:
        s = coef[key].dropna()
        print(f"  {key:16s} {s.index[-1]:%b %Y}  {s.iloc[-1]:.3f}")
    for spec in SPECS:
        nt = notes[spec.key]
        if nt["interpolated"] or nt["carried_forward"] or nt["spliced"]:
            print(f"  notes {spec.key}: interp={len(nt['interpolated'])} carried={len(nt['carried_forward'])} "
                  f"spliced={month_ranges(nt['spliced'])}")
    print(f"Saved {WORKBOOK_PATH}")
    print(f"Saved {WEB_DATA_PATH}")


if __name__ == "__main__":
    main()
