/**
 * config.js
 * ---------------------------------------------------------------
 * Central configuration: CMS Provider Data Catalog (PDC) dataset
 * IDs, claims-based quality measure codes, and small static
 * lookups (state names, CMS regions).
 *
 * Dataset IDs were confirmed live against the PDC datastore API
 * (https://data.cms.gov/provider-data/api/1/datastore/query/{id}/0)
 * as of June 2026:
 *   - Provider Information ......... 4pq5-n9py
 *   - Medicare Claims Quality Msrs.. ijh5-nb2v
 *   - State & US Averages ........... xcdc-v8bm
 *
 * If CMS rotates a dataset ID during a future refresh, update the
 * value below — the rest of the app does not need to change.
 * ---------------------------------------------------------------
 */

const CONFIG = {
  CMS_API_BASE: "https://data.cms.gov/provider-data/api/1/datastore/query",

  // Browsers block direct calls to data.cms.gov (no CORS headers), so
  // requests are routed through a public CORS proxy that simply
  // forwards the request and adds the missing headers. The app tries
  // each of these in order (an empty string "" means "call CMS
  // directly, no proxy") and uses the first one that works.
  CORS_PROXIES: [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?url=",
    "",
  ],

  DATASETS: {
    // NH_ProviderInfo_MonYYYY.csv — facility metadata, bed count, star ratings
    PROVIDER_INFO: "4pq5-n9py",
    // NH_QualityMsr_Claims_MonYYYY.csv — facility-level claims-based QMs
    CLAIMS_QUALITY_MEASURES: "ijh5-nb2v",
    // NH_StateUSAverages_MonYYYY.csv — state & national averages
    STATE_US_AVERAGES: "xcdc-v8bm",
  },

  // Claims-based quality measure codes (see NH Data Dictionary, Table 16
  // revision history for 201810 / 201904 — these are the measure codes
  // CMS assigned to the SNF hospitalization / ED-visit measures).
  MEASURE_CODES: {
    SHORT_STAY_HOSPITALIZATION: "401", // % short-stay residents rehospitalized
    SHORT_STAY_ED_VISIT: "471", // % short-stay residents w/ outpatient ED visit
    LONG_STAY_HOSPITALIZATION: "551", // # hospitalizations / 1000 long-stay resident days
    LONG_STAY_ED_VISIT: "552", // # outpatient ED visits / 1000 long-stay resident days
  },

  // Used to build the "Medicare Source Hyperlink" required by the spec.
  // The spec's Section 2 example is the bare profile URL
  // (.../nursing-home/{CCN}), but Section 5's "Sample Expected Output"
  // for the CCN 686123 test case is the fuller
  // .../nursing-home/{CCN}/view-all?state={STATE} form — so we build
  // that fuller form whenever we know the facility's state, and fall
  // back to the bare URL otherwise.
  careCompareUrl(ccn, state) {
    const base = `https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`;
    return state ? `${base}/view-all?state=${state}` : base;
  },

  // Branding text — per the case study's "Critical Branding Guardrail",
  // this is HARD-CODED and must never be overwritten by API or user data.
  BRAND: {
    PLATFORM_NAME: "INFINITE",
    MANAGED_BY: "Managed by MEDELITE",
    REPORT_TITLE: "FACILITY ASSESSMENT SNAPSHOT",
  },
};

// Map of 2-letter postal codes -> full state names, used for display
// and for filtering the State & US Averages dataset.
const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming",
};
