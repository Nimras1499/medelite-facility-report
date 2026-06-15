# Facility Assessment Report Generator

**INFINITE — Managed by MEDELITE**

A lightweight micro-app built for the Medelite "Facility Assessment Report
Generator" technical case study. Enter a facility's CMS Certification Number
(CCN) to pull live data from the **CMS Provider Data Catalog**, layer on
Medelite's internal operational notes, and download a polished, branded PDF
or Word snapshot.

---

## Features

### MVP (required)

- **Dynamic CCN lookup** against the public CMS Provider Data Catalog (PDC)
  Open Data API — no API key required.
- **Data Engine**: pulls facility name, address, certified bed count, and all
  four CMS Five-Star ratings (Overall, Health Inspection, Staffing, Quality of
  Resident Care).
- **Facility name override**: defaults to the CMS legal name, but a manual
  text field lets you substitute Medelite's internal name for the report —
  without touching the `INFINITE` platform branding (see Branding guardrail
  below).
- **Manual operational inputs**: EMR, Current Census, Type of Patient,
  Previous Coverage from Medelite, Previous Provider Performance, Medical
  Coverage.
- **One-click PDF export** — a clean, print-ready report.
- **Medicare source hyperlink** — every report links to
  `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}` using the
  CCN that was searched.

### Bonus

- **All 12 hospitalization/ED metrics** (short-stay + long-stay, facility vs.
  state vs. national averages), pulled from the CMS claims-based quality
  measures dataset and the state/national averages dataset.
- **Word (.doc) export** in addition to PDF.
- **Charts**: two grouped bar charts (Chart.js) comparing this facility's
  short-stay and long-stay hospitalization/ED rates against state and
  national averages.
- **Error handling**: invalid/unknown CCNs show a clear message; if the
  bonus datasets fail to load, the MVP fields still render and a warning is
  shown instead of a hard crash.

---

## Running it locally

This is a static site (no build step, no backend, no `node_modules`).

```bash
# from the project root
python3 -m http.server 8080
# then open http://localhost:8080
```

Or just open `index.html` directly in a browser — all libraries (Chart.js,
jsPDF, jsPDF-AutoTable, Google Fonts) load from public CDNs.

## Deploying it

Because there's no build step, any static host works:

- **GitHub Pages**: push this repo, then enable Pages on the `main` branch
  (root folder) under *Settings → Pages*.
- **Netlify / Vercel**: drag-and-drop the folder, or connect the repo with no
  build command and `/` as the publish directory.

---

## Test case

| Input | Expected result |
|---|---|
| CCN `686123` | Kendall Lakes Healthcare and Rehab Center, Miami, FL — Overall star 1, Health Inspection star 1, Staffing star 2, Quality of Resident Care star 4, 120 certified beds. The hospitalization/ED table should closely match `Kendall_Lakes_Healthcare_and_Rehab_Center.pdf` (18.7% short-term hospitalization, 13.9% short-term ED visit, 1.86 long-term hospitalization, 6.94 long-term ED visit, etc.). |

A **"686123" shortcut button** is included on the lookup card for quick
testing.

---

## Data mapping

| Report Field | Source | CMS Provider Data Catalog field |
|---|---|---|
| Name of Facility | CMS API + manual override | `provider_name` (overridable) |
| Location | CMS API | `provider_address`, `citytown`, `state`, `zip_code` |
| EMR | Manual | — |
| Census Capacity | CMS API | `number_of_certified_beds` |
| Current Census | Manual | — |
| Type of Patient | Manual | — |
| Previous Coverage from Medelite | Manual | — |
| Previous Provider Performance from Medelite | Manual | — |
| Medical Coverage | Manual | — |
| Overall Star Rating | CMS API | `overall_rating` |
| Health Inspection | CMS API | `health_inspection_rating` |
| Staffing | CMS API | `staffing_rating` |
| Quality of Resident Care | CMS API | `qm_rating` |
| Short Term Hospitalization (+ Natl/State avg) | CMS API (claims measures + state/US averages) | Measure `401` |
| STR ED Visit (+ Natl/State avg) | CMS API | Measure `471` |
| LT Hospitalization (+ Natl/State avg) | CMS API | Measure `551` |
| LT ED Visit (+ Natl/State avg) | CMS API | Measure `552` |

### CMS Provider Data Catalog datasets used

| Dataset | ID | Used for |
|---|---|---|
| Provider Information | `4pq5-n9py` | Facility metadata, bed count, Five-Star ratings |
| Medicare Claims Quality Measures | `ijh5-nb2v` | Facility-level hospitalization/ED rates (measures 401/471/551/552) |
| State & US Averages | `xcdc-v8bm` | State and national averages for the same measures |

Each dataset is queried via the PDC datastore API:

```
GET https://data.cms.gov/provider-data/api/1/datastore/query/{datasetId}/0
    ?conditions[0][property]=cms_certification_number_ccn
    &conditions[0][value]={CCN}
    &conditions[0][operator]==
```

---

## Branding guardrail

Per the case study spec, `"INFINITE"` and `"Managed by MEDELITE"` are
**hardcoded constants** in `js/config.js` (`CONFIG.BRAND`) and are rendered
directly in the header / PDF / Word export. They are never read from the CMS
API or from the facility-name override field — the override only ever affects
the **"Name of Facility"** row in the report body.

---

## Assumptions & known limitations

These are documented per the case study's "make a reasonable engineering
assumption and document it" guidance:

1. **CORS**: the app calls `data.cms.gov` directly from the browser. The PDC
   API is a public, read-only open-data endpoint intended for exactly this
   kind of integration. If CMS ever tightens CORS policy and browser requests
   start failing, the fix is a one-file serverless proxy (e.g. a single
   Vercel/Netlify function that forwards the same query string to
   `data.cms.gov` and returns the JSON) — `js/api.js` would only need its
   `CMS_API_BASE` constant changed to point at the proxy.

2. **Dataset IDs can rotate** on a CMS data refresh. They're centralized in
   `js/config.js` (`CONFIG.DATASETS`) so they're a one-line fix if CMS ever
   changes them. As of June 2026 they're confirmed working.

3. **Field-name resilience**: CMS occasionally tweaks column header
   punctuation/casing between monthly refreshes (e.g. "Long-Stay" vs.
   "longstay"). `js/api.js` uses a small fuzzy-matching helper (`fuzzyGet`)
   that normalizes keys and matches on keyword fragments, rather than relying
   on one exact string, so minor schema drift shouldn't break the app.

4. **Measure codes 401 / 471 / 551 / 552**: per the NH Data Dictionary's
   revision history (Table 16), these are the claims-based measure codes for
   short-stay rehospitalization, short-stay ED visits, long-stay
   hospitalizations per 1,000 resident days, and long-stay ED visits per 1,000
   resident days, respectively.

5. **CCN format**: CMS Certification Numbers are 6 characters and can include
   letters (e.g. swing-bed units), so the input field accepts free text rather
   than enforcing 6 digits.

6. **Word export** uses an HTML-to-`.doc` technique (an HTML document served
   with an `application/msword` MIME type) rather than a full OOXML library.
   This opens natively in Microsoft Word and Google Docs without adding a
   heavy client-side dependency, at the cost of more limited formatting
   fidelity than a true `.docx`.

---

## Project structure

```
medelite-facility-report/
├── index.html          # page structure
├── css/
│   └── styles.css       # INFINITE/Medelite branding + layout
├── js/
│   ├── config.js        # dataset IDs, measure codes, brand constants
│   ├── api.js            # CMS PDC API client + normalization ("Data Engine")
│   ├── charts.js          # bonus Chart.js visualizations
│   ├── export.js          # PDF (jsPDF) + Word (.doc) export
│   └── app.js              # UI wiring, state, rendering
└── README.md
```

---

## Possible future improvements

- Cache CCN lookups (sessionStorage) to avoid re-querying the same facility.
- Debounce/validate CCN input and support lookup-by-name.
- Add a print stylesheet so the on-screen view itself is print-ready.
- Swap the `.doc` export for a true `.docx` via the `docx` library if richer
  formatting is needed.
