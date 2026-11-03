"""Evaluate the workbook's formulas with pycel and compare them to the Python computation."""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

from openpyxl import load_workbook
from pycel import ExcelCompiler

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_workbook as bw  # noqa: E402


def main() -> None:
    df, _, _ = bw.build_monthly()
    coef = bw.compute_coefficients(df)
    wb = load_workbook(bw.WORKBOOK_PATH)
    ws = wb["Coefficients"]
    header = {ws.cell(row=4, column=c).value: c for c in range(2, ws.max_column + 1)}
    excel = ExcelCompiler(filename=str(bw.WORKBOOK_PATH))

    labels = {"composite_cpi": "Composite: CPI-style basket", "composite_lived": "Composite: lived-experience basket",
              "real_wage": "Real wage (hourly wages / CPI-U)"}
    for s in bw.SPECS:
        if s.group != "splice":
            labels[s.key] = s.label + (" (linked to CPI-U at Apr 2000)" if s.link_to_cpi else "")

    worst = 0.0
    checked = 0
    rows = [0, 1, 63, 200, len(df) - 2, len(df) - 1]
    for key, label in labels.items():
        col = header[label]
        for i in rows:
            expected = coef[key].iloc[i]
            cell = f"Coefficients!{ws.cell(row=bw.COEF_FIRST_ROW + i, column=col).coordinate}"
            got = excel.evaluate(cell)
            if expected != expected:  # NaN: the workbook cell should be empty
                assert got in (None, ""), f"{key} row {i}: expected blank, got {got}"
                continue
            diff = abs(float(got) - expected)
            worst = max(worst, diff)
            checked += 1
            assert diff < 1e-9, f"{key} row {i}: workbook {got} vs python {expected}"

    dash = wb["Dashboard"]
    for r in range(6, dash.max_row + 1):
        if dash.cell(row=r, column=3).value and str(dash.cell(row=r, column=3).value).startswith("="):
            excel.evaluate(f"Dashboard!C{r}")
            excel.evaluate(f"Dashboard!D{r}")
    print(f"Checked {checked} coefficient cells; max abs difference {worst:.2e}")
    for name in ("composite_cpi", "composite_lived"):
        print(f"  {name} latest: workbook "
              f"{excel.evaluate(f'Coefficients!{ws.cell(row=bw.COEF_FIRST_ROW + len(df) - 1, column=header[labels[name]]).coordinate}'):.4f}")
    print(f"  Dashboard CPI-U row: coef={excel.evaluate('Dashboard!C7'):.4f} annual={excel.evaluate('Dashboard!D7'):.4%}")
    with zipfile.ZipFile(bw.WORKBOOK_PATH) as z:
        charts = [n for n in z.namelist() if n.startswith("xl/charts/chart")]
    print(f"  Chart parts in workbook: {len(charts)}")

    payload = json.loads(bw.WEB_DATA_PATH.read_text(encoding="utf-8"))
    assert payload["meta"]["baseMonth"] == "1995-01"
    assert payload["months"][0] == "1995-01"
    assert payload["months"][-1] == df.index[-1].strftime("%Y-%m")
    assert len(payload["series"]) == len(payload["coefficients"])
    for key, values in payload["coefficients"].items():
        assert len(values) == len(df), f"{key}: wrong number of observations"
        if values[0] is not None:
            assert abs(values[0] - 1.0) < 1e-9, f"{key}: base month is not 1.0"
    for key in ("composite_cpi", "composite_lived"):
        exported = payload["coefficients"][key]
        expected = coef[key].tolist()
        assert max(abs(a - b) for a, b in zip(exported, expected)) < 1e-8
    print(f"  Web data: {len(payload['series'])} series x {len(payload['months'])} months")


if __name__ == "__main__":
    main()
