/**
 * app.js
 * ---------------------------------------------------------------
 * Orchestrates the UI: handles the CCN lookup, binds manual inputs,
 * renders star ratings + the hospitalization/ED metrics table and
 * chart, and wires up the PDF / Word export buttons.
 *
 * All state for the "current report" lives in `state` below and is
 * what gets handed to export.js when the user downloads a file.
 * ---------------------------------------------------------------
 */

const state = {
  ccn: "",
  apiName: "", // legal name from CMS API
  nameOverride: "", // optional user override
  address: "",
  city: "",
  facilityState: "", // 2-letter
  zip: "",
  bedCount: null,
  ratings: {
    overall: null,
    healthInspection: null,
    staffing: null,
    qualityOfResidentCare: null,
  },
  hospitalization: null, // filled in by buildHospitalizationRows()
  warnings: [],
  lookedUp: false,
};

/* ------------------------------ DOM refs ------------------------------ */

const els = {
  ccnInput: document.getElementById("ccnInput"),
  lookupBtn: document.getElementById("lookupBtn"),
  lookupSpinner: document.getElementById("lookupSpinner"),
  statusBox: document.getElementById("statusBox"),
  stateCode: document.getElementById("stateCode"),

  resultsSection: document.getElementById("resultsSection"),

  nameOverrideInput: document.getElementById("nameOverrideInput"),
  resolvedName: document.getElementById("resolvedName"),
  apiNameHint: document.getElementById("apiNameHint"),

  locationValue: document.getElementById("locationValue"),
  bedCountValue: document.getElementById("bedCountValue"),

  emrInput: document.getElementById("emrInput"),
  currentCensusInput: document.getElementById("currentCensusInput"),
  typeOfPatientInput: document.getElementById("typeOfPatientInput"),
  previousCoverageSelect: document.getElementById("previousCoverageSelect"),
  previousPerformanceInput: document.getElementById("previousPerformanceInput"),
  medicalCoverageInput: document.getElementById("medicalCoverageInput"),

  ratingsGrid: document.getElementById("ratingsGrid"),

  hospTableBody: document.getElementById("hospTableBody"),
  hospChartCanvas: document.getElementById("hospChart"),

  careCompareLink: document.getElementById("careCompareLink"),

  downloadPdfBtn: document.getElementById("downloadPdfBtn"),
  downloadDocxBtn: document.getElementById("downloadDocxBtn"),
};

/* ------------------------------ Helpers ------------------------------- */

function setStatus(message, kind) {
  // kind: 'info' | 'error' | 'warning' | ''
  els.statusBox.textContent = message || "";
  els.statusBox.className = "status-box" + (kind ? ` status-${kind}` : "");
  els.statusBox.hidden = !message;
}

function fmtPercent(n) {
  return n === null || n === undefined ? "—" : `${n.toFixed(1)}%`;
}

function fmtRate(n) {
  return n === null || n === undefined ? "—" : n.toFixed(2);
}

function resolvedFacilityName() {
  return (state.nameOverride && state.nameOverride.trim()) || state.apiName || "—";
}

/* --------------------------- Rating bar UI ----------------------------- */

const RATING_DEFS = [
  { key: "overall", label: "Overall Star Rating" },
  { key: "healthInspection", label: "Health Inspection" },
  { key: "staffing", label: "Staffing" },
  { key: "qualityOfResidentCare", label: "Quality of Resident Care" },
];

function renderRatings() {
  els.ratingsGrid.innerHTML = "";
  RATING_DEFS.forEach((def) => {
    const value = state.ratings[def.key];
    const card = document.createElement("div");
    card.className = "rating-card";

    const label = document.createElement("div");
    label.className = "rating-label";
    label.textContent = def.label;

    const bar = document.createElement("div");
    bar.className = "rating-bar";
    for (let i = 1; i <= 5; i++) {
      const seg = document.createElement("span");
      seg.className = "rating-seg" + (value && i <= value ? " filled" : "");
      bar.appendChild(seg);
    }

    const num = document.createElement("div");
    num.className = "rating-number";
    num.textContent = value === null || value === undefined ? "N/A" : `${value} / 5`;

    card.appendChild(label);
    card.appendChild(bar);
    card.appendChild(num);
    els.ratingsGrid.appendChild(card);
  });
}

/* ---------------------- Hospitalization / ED table --------------------- */

/**
 * Build the 12-row hospitalization/ED dataset from the claims measures
 * + state/national averages returned by the API. Falls back to "—" for
 * anything that couldn't be loaded.
 */
function buildHospitalizationRows(claimsMeasures, averages) {
  const M = CONFIG.MEASURE_CODES;
  const get = (code, field) => claimsMeasures?.[code]?.[field] ?? null;

  const stateAvg = averages?.state || {};
  const nationAvg = averages?.nation || {};

  return [
    {
      label: "Short Term Hospitalization",
      value: get(M.SHORT_STAY_HOSPITALIZATION, "observed"),
      fmt: fmtPercent,
      group: "STR Hospitalization",
    },
    {
      label: "STR National Avg. for Hospitalization",
      value: nationAvg.shortStayHosp,
      fmt: fmtPercent,
      group: "STR Hospitalization",
    },
    {
      label: "STR State Avg. for Hospitalization",
      value: stateAvg.shortStayHosp,
      fmt: fmtPercent,
      group: "STR Hospitalization",
    },
    {
      label: "STR ED Visit",
      value: get(M.SHORT_STAY_ED_VISIT, "observed"),
      fmt: fmtPercent,
      group: "STR ED Visit",
    },
    {
      label: "STR ED Visits National Avg.",
      value: nationAvg.shortStayED,
      fmt: fmtPercent,
      group: "STR ED Visit",
    },
    {
      label: "STR ED Visits State Avg.",
      value: stateAvg.shortStayED,
      fmt: fmtPercent,
      group: "STR ED Visit",
    },
    {
      label: "LT Hospitalization",
      value: get(M.LONG_STAY_HOSPITALIZATION, "observed"),
      fmt: fmtRate,
      group: "LT Hospitalization",
    },
    {
      label: "LT National Avg. for Hospitalization",
      value: nationAvg.longStayHosp,
      fmt: fmtRate,
      group: "LT Hospitalization",
    },
    {
      label: "LT State Avg. for Hospitalization",
      value: stateAvg.longStayHosp,
      fmt: fmtRate,
      group: "LT Hospitalization",
    },
    {
      label: "ED Visit (LT)",
      value: get(M.LONG_STAY_ED_VISIT, "observed"),
      fmt: fmtRate,
      group: "LT ED Visit",
    },
    {
      label: "LT ED Visits National Avg.",
      value: nationAvg.longStayED,
      fmt: fmtRate,
      group: "LT ED Visit",
    },
    {
      label: "LT ED Visits State Avg.",
      value: stateAvg.longStayED,
      fmt: fmtRate,
      group: "LT ED Visit",
    },
  ];
}

function renderHospitalizationTable(rows) {
  els.hospTableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = row.label;

    const tdValue = document.createElement("td");
    tdValue.className = "num";
    tdValue.textContent = row.value === null ? "—" : row.fmt(row.value);

    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);
    els.hospTableBody.appendChild(tr);
  });
}

/* ------------------------------ Lookup flow ----------------------------- */

async function handleLookup() {
  const ccn = els.ccnInput.value.trim();
  if (!ccn) {
    setStatus("Enter a CMS Certification Number (CCN) to look up a facility.", "error");
    return;
  }

  els.lookupBtn.disabled = true;
  els.lookupSpinner.hidden = false;
  setStatus("Looking up facility " + ccn + "…", "info");

  try {
    const { providerInfo, claimsMeasures, averages, warnings } = await fetchFacilityBundle(ccn);

    // --- core state ---
    state.ccn = providerInfo.ccn;
    state.apiName = providerInfo.legalName;
    state.address = providerInfo.address;
    state.city = providerInfo.city;
    state.facilityState = providerInfo.state;
    state.zip = providerInfo.zip;
    state.bedCount = providerInfo.bedCount;
    state.ratings.overall = providerInfo.overallRating;
    state.ratings.healthInspection = providerInfo.healthInspectionRating;
    state.ratings.staffing = providerInfo.staffingRating;
    state.ratings.qualityOfResidentCare = providerInfo.qmRating;
    state.warnings = warnings;
    state.lookedUp = true;

    // --- hospitalization / ED bonus data ---
    state.hospitalization = buildHospitalizationRows(claimsMeasures, averages);

    renderAll();

    if (warnings.length) {
      setStatus(warnings.join(" "), "warning");
    } else {
      setStatus(`Loaded data for ${providerInfo.legalName} (CCN ${providerInfo.ccn}).`, "info");
    }
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Something went wrong looking up that facility.", "error");
  } finally {
    els.lookupBtn.disabled = false;
    els.lookupSpinner.hidden = true;
  }
}

/* -------------------------------- Render -------------------------------- */

function renderAll() {
  els.resultsSection.hidden = false;

  // Header state code
  els.stateCode.textContent = state.facilityState || "—";

  // Name + override hint
  els.resolvedName.textContent = resolvedFacilityName();
  els.apiNameHint.textContent = state.apiName
    ? `CMS legal name on file: ${state.apiName}`
    : "";

  // Location
  const locationParts = [state.address, state.city, state.facilityState, state.zip].filter(
    Boolean
  );
  els.locationValue.textContent = locationParts.length
    ? locationParts.join(", ")
    : "—";

  // Census capacity (read-only, from API)
  els.bedCountValue.textContent =
    state.bedCount === null || state.bedCount === undefined ? "—" : String(state.bedCount);

  // Ratings
  renderRatings();

  // Hospitalization table + chart
  renderHospitalizationTable(state.hospitalization || []);
  renderHospChart(els.hospChartCanvas, state.hospitalization || []);

  // Medicare Care Compare link (dynamic CCN — required hyperlink)
  const url = CONFIG.careCompareUrl(state.ccn);
  els.careCompareLink.href = url;
  els.careCompareLink.textContent = url;

  // Enable export buttons now that we have data
  els.downloadPdfBtn.disabled = false;
  els.downloadDocxBtn.disabled = false;
}

/* ----------------------------- Manual inputs ----------------------------- */

function bindManualInputs() {
  els.nameOverrideInput.addEventListener("input", () => {
    state.nameOverride = els.nameOverrideInput.value;
    if (state.lookedUp) {
      els.resolvedName.textContent = resolvedFacilityName();
    }
  });
}

/** Collect the full report object (API data + manual inputs) for export. */
function buildReportData() {
  return {
    state: state.facilityState || "",
    facilityName: resolvedFacilityName(),
    location: [state.address, state.city, state.facilityState, state.zip]
      .filter(Boolean)
      .join(", "),
    emr: els.emrInput.value.trim() || "—",
    censusCapacity: state.bedCount === null ? "—" : String(state.bedCount),
    currentCensus: els.currentCensusInput.value.trim() || "—",
    typeOfPatient: els.typeOfPatientInput.value.trim() || "—",
    previousCoverage: els.previousCoverageSelect.value || "—",
    previousProviderPerformance: els.previousPerformanceInput.value.trim() || "—",
    medicalCoverage: els.medicalCoverageInput.value.trim() || "—",
    ratings: state.ratings,
    hospitalization: state.hospitalization || [],
    ccn: state.ccn,
    careCompareUrl: CONFIG.careCompareUrl(state.ccn),
  };
}

/* -------------------------------- Wire up -------------------------------- */

els.lookupBtn.addEventListener("click", handleLookup);
els.ccnInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLookup();
});

bindManualInputs();

els.downloadPdfBtn.addEventListener("click", () => {
  try {
    generatePdfReport(buildReportData());
  } catch (err) {
    console.error(err);
    setStatus("Could not generate the PDF: " + err.message, "error");
  }
});

els.downloadDocxBtn.addEventListener("click", () => {
  try {
    generateDocxReport(buildReportData());
  } catch (err) {
    console.error(err);
    setStatus("Could not generate the Word document: " + err.message, "error");
  }
});

// Render an empty ratings grid + hospitalization table on first load so
// the layout doesn't jump once data arrives.
renderRatings();
renderHospitalizationTable(buildHospitalizationRows({}, {}));
