# VMI Executive Sales & Preroll Performance Dashboard

Production-grade, two-page interactive analytical web dashboard built for VMI executive leadership, analyzing multi-period sales and preroll performance data across hundreds of retail dispensary partners.

## 🌟 Overview & Key Features

### Page 1: 13-Week vs. 13-Week Client & Rep Order Comparison (`/index.html`)
- **Period 1 (TP1)**: `05/04/2026 - 08/02/2026` (`3,428` orders, `$13,637,917.96` ordered, `2,706,833` units, `$3,978.39` AOV).
- **Period 2 (TP2)**: `08/03/2026 - 11/01/2026` (`3,642` orders, `$14,038,451.18` ordered, `2,747,332` units, `$3,854.60` AOV).
- **Net Delta**: `+214` orders (+6.24%), `+$400,533.22` rev diff (+2.94%), `+40,499` unit diff (+1.50%), `-$123.79` AOV diff (-3.11%).
- **Visual Analytics**:
  - Sales Rep Revenue Comparison (TP1 vs TP2 visual bar charts across 13 sales rep and house lines).
  - Top 10 Gainers & Decliners diverging bar charts.
- **Sales Rep Performance Table**:
  - Complete 13-row breakdown with order, rev, unit, and AOV deltas.
  - One-click toggle to consolidate House accounts into 9 unique sales reps.
- **Client Data Explorer**:
  - Tab A: `13v13 Comparison Diffs` (403 client rows + Total row) joined with baseline TP1 & TP2 values.
  - Tab B: `Period 1 TP1` (399 client rows + Total row).
  - Tab C: `Period 2 TP2` (400 client rows + Total row).
  - Instant client search, tag filters (`All`, `VMI Only`, `1WT Only`, `Chain Stores [BRACKET]`, `Revenue Up`, `Revenue Down`), column sorting on every metric, and CSV export.

### Page 2: 12-Week Preroll Performance & Latest 12wk Voids (`/preroll-performance.html`)
- **Period 1 (TP1)**: `05/11/2026 - 08/02/2026` (`2,806` orders, `$2,323,107.17` ordered, `1,016,928` units, `$827.91` AOV).
- **Period 2 (TP2)**: `08/03/2026 - 11/29/2026` (`2,974` orders, `$2,193,701.82` ordered, `980,598` units, `$737.63` AOV).
- **Net Delta**: `+168` orders (+5.99%), `-$129,405.35` rev diff (-5.57%), `-36,330` unit diff (-3.57%), `-$90.28` AOV diff (-10.90%).
- **Account Dynamics**: `13 Gained (G)` vs `18 Lost (L)` accounts.
- **View 1 (Client Performance - 404 accounts)**:
  - Resolves the 11 acquired account records where Column A held `"Clutch Cannabis"` with 0 orders, surfacing the true acquired dispensary name while preserving full audit history.
  - Filter pills for Gained (`G`), Lost (`L`), VMI, 1WT, Sales Rep territory, and CSV export.
- **View 2 (Category Voids Explorer - 2,287 entries across 10 categories)**:
  - Category breakdown chart across all 10 Preroll Categories (`Banger Prerolls (10pk)`, `Banger Prerolls (2pk)`, `Banger Prerolls (5pk)`, `Bubble Hash Bangers`, `Dabstract Infused Prerolls`, `Firecrackers`, `Mega Rolls`, `Prerolls (Single Unit)`, `Prerolls 28pk`, `Prerolls Huxton`).
  - Territory void opportunities by Sales Rep.
  - **Flat Roster View** (2,287 rows) with instant category, rep, tag filtering.
  - **Store × Category Matrix View** showing each client row against all 10 categories with clear VOID badges.

---

## 🚀 Getting Started

### 1. Extract Data
The extraction script uses Python 3's standard library (`zipfile`, `xml.etree.ElementTree`, `json`) with zero third-party dependencies:
```bash
python scripts/extract_data.py
# or
npm run extract
```

### 2. Run Verification Suite
```bash
node tests/verify.test.js
# or
npm test
```

### 3. Run Locally
Serve the static files using any HTTP server:
```bash
npx serve .
# or
python -m http.server 3000
```
Open `http://localhost:3000` or `http://localhost:3000/index.html`.

---

## 🌐 Vercel Deployment
The dashboard follows a zero-config static layout with `vercel.json` configured for clean URLs:
- `/` serves `index.html` (Report 1: 13v13 Comparison)
- `/preroll-performance` serves `preroll-performance.html` (Report 2: Preroll & Voids)
- All static assets and data files are served directly without serverless function overhead.
