/**
 * api.js
 * ---------------------------------------------------------------
 * "Data Engine" — talks to the CMS Provider Data Catalog (PDC)
 * Open Data API and normalizes the responses into the clean
 * shape the rest of the app expects.
 *
 * PDC datastore query format:
 *   {CMS_API_BASE}/{datasetId}/0
 *     ?conditions[0][property]=<field>
 *     &conditions[0][value]=<value>
 *     &conditions[0][operator]==
 *
 * All requests are simple GETs and the PDC is a public, read-only
 * open-data endpoint, so no API key is required.
 * ---------------------------------------------------------------
 */

class CmsApiError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = "CmsApiError";
    if (cause) this.cause = cause;
  }
}

/**
 * Build a PDC datastore query URL.
 * @param {string} datasetId
 * @param {Array<{property: string, value: string, operator?: string}>} conditions
 */
function buildQueryUrl(datasetId, conditions = []) {
  const params = new URLSearchParams();
  conditions.forEach((cond, i) => {
    params.set(`conditions[${i}][property]`, cond.property);
    params.set(`conditions[${i}][value]`, cond.value);
    params.set(`conditions[${i}][operator]`, cond.operator || "=");
  });
  return `${CONFIG.CMS_API_BASE}/${datasetId}/0?${params.toString()}`;
}

async function pdcQuery(datasetId, conditions) {
  const url = buildQueryUrl(datasetId, conditions);
  const attempts = CONFIG.CORS_PROXIES.length ? CONFIG.CORS_PROXIES : [""];

  let lastError;
  for (const proxy of attempts) {
    const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
    try {
      const response = await fetch(fetchUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        lastError = new CmsApiError(
          `CMS API returned an error (HTTP ${response.status}) for dataset ${datasetId}.`
        );
        continue;
      }
      const json = await response.json();
      if (!Array.isArray(json.results)) {
        lastError = new CmsApiError("CMS API returned an unexpected response shape.");
        continue;
      }
      return json.results;
    } catch (err) {
      lastError = err;
      continue; // try the next proxy
    }
  }

  throw new CmsApiError(
    "Could not reach the CMS Provider Data Catalog through any available connection. Check your network connection.",
    { cause: lastError }
  );
}

/**
 * Fuzzy field lookup. CMS occasionally tweaks column-header casing,
 * punctuation, or hyphenation between monthly refreshes. Rather than
 * hardcoding brittle exact keys, we normalize every key on the row
 * (lowercase, strip non-alphanumerics) and find the first key whose
 * normalized form contains every supplied keyword fragment.
 *
 * @param {Object} row - a single record from the PDC API
 * @param {string[]} keywords - lowercase alphanumeric fragments, e.g. ['overall','rating']
 * @returns {string|undefined}
 */
function fuzzyGet(row, keywords) {
  if (!row) return undefined;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const key of Object.keys(row)) {
    const normKey = normalize(key);
    if (keywords.every((kw) => normKey.includes(kw))) {
      const val = row[key];
      return val === "" || val === null ? undefined : val;
    }
  }
  return undefined;
}

/** Convert a CMS string value to a number, or null if blank/invalid. */
function toNumber(val) {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/* ----------------------------------------------------------------
 * Provider Information (dataset: 4pq5-n9py)
 * ---------------------------------------------------------------- */

/**
 * Fetch and normalize the Provider Information row for a CCN.
 * @param {string} ccn - 6-character CMS Certification Number
 * @returns {Promise<Object>} normalized facility record
 */
async function fetchProviderInfo(ccn) {
  const rows = await pdcQuery(CONFIG.DATASETS.PROVIDER_INFO, [
    { property: "cms_certification_number_ccn", value: ccn, operator: "=" },
  ]);

  if (rows.length === 0) {
    throw new CmsApiError(
      `No facility found for CCN "${ccn}". Double-check the CMS Certification Number.`
    );
  }

  const row = rows[0];

  return {
    ccn: fuzzyGet(row, ["ccn"]) ?? ccn,
    legalName: fuzzyGet(row, ["providername"]) ?? "",
    address: fuzzyGet(row, ["provideraddress"]) ?? "",
    city: fuzzyGet(row, ["city"]) ?? "",
    state: (fuzzyGet(row, ["state"]) ?? "").toUpperCase(),
    zip: fuzzyGet(row, ["zip"]) ?? "",
    bedCount: toNumber(fuzzyGet(row, ["numberofcertifiedbeds"])),
    avgResidentsPerDay: toNumber(fuzzyGet(row, ["averagenumberofresidentsperday"])),
    overallRating: toNumber(fuzzyGet(row, ["overallrating"])),
    healthInspectionRating: toNumber(fuzzyGet(row, ["healthinspectionrating"])),
    staffingRating: toNumber(fuzzyGet(row, ["staffingrating"])),
    qmRating: toNumber(fuzzyGet(row, ["qmrating"]) ?? fuzzyGet(row, ["qualitymeasure", "rating"])),
    longStayQmRating: toNumber(fuzzyGet(row, ["longstay", "rating"])),
    shortStayQmRating: toNumber(fuzzyGet(row, ["shortstay", "rating"])),
    ownershipType: fuzzyGet(row, ["ownershiptype"]) ?? "",
    providerType: fuzzyGet(row, ["providertype"]) ?? "",
    latitude: toNumber(fuzzyGet(row, ["latitude"])),
    longitude: toNumber(fuzzyGet(row, ["longitude"])),
    processingDate: fuzzyGet(row, ["processingdate"]) ?? "",
    _raw: row,
  };
}

/* ----------------------------------------------------------------
 * Medicare Claims Quality Measures (dataset: ijh5-nb2v)
 * ---------------------------------------------------------------- */

/**
 * Fetch facility-level claims-based hospitalization / ED measures.
 * Returns a map keyed by measure code, e.g. { "401": {observed, adjusted}, ... }
 * @param {string} ccn
 */
async function fetchClaimsMeasures(ccn) {
  const rows = await pdcQuery(CONFIG.DATASETS.CLAIMS_QUALITY_MEASURES, [
    { property: "cms_certification_number_ccn", value: ccn, operator: "=" },
  ]);

  const wanted = new Set(Object.values(CONFIG.MEASURE_CODES));
  const byCode = {};

  rows.forEach((row) => {
    const codeRaw = fuzzyGet(row, ["measurecode"]);
    if (codeRaw === undefined) return;
    // Measure codes can come back as "401" or "401.0" — normalize to a
    // 3-digit string for comparison against CONFIG.MEASURE_CODES.
    const code = String(parseInt(codeRaw, 10));
    if (!wanted.has(code)) return;

    byCode[code] = {
      observed: toNumber(fuzzyGet(row, ["observedscore"])),
      adjusted: toNumber(fuzzyGet(row, ["adjustedscore"])),
      footnote: fuzzyGet(row, ["footnote"]) ?? "",
      residentType: fuzzyGet(row, ["residenttype"]) ?? "",
      measurePeriod: fuzzyGet(row, ["measureperiod"]) ?? "",
    };
  });

  return byCode;
}

/* ----------------------------------------------------------------
 * State & US Averages (dataset: xcdc-v8bm)
 * ---------------------------------------------------------------- */

/**
 * Fetch the relevant hospitalization/ED averages for a given state
 * abbreviation, plus the national ("NATION") row.
 * @param {string} stateAbbr - 2-letter postal abbreviation, e.g. "FL"
 * @returns {Promise<{state: Object, nation: Object}>}
 */
async function fetchStateAndNationalAverages(stateAbbr) {
  const [stateRows, nationRows] = await Promise.all([
    pdcQuery(CONFIG.DATASETS.STATE_US_AVERAGES, [
      { property: "state_or_nation", value: stateAbbr, operator: "=" },
    ]),
    pdcQuery(CONFIG.DATASETS.STATE_US_AVERAGES, [
      { property: "state_or_nation", value: "NATION", operator: "=" },
    ]),
  ]);

  const extract = (rows) => {
    const row = rows[0];
    if (!row) return null;
    return {
      shortStayHosp: toNumber(
        fuzzyGet(row, ["percentage", "shortstay", "rehospitalized"])
      ),
      shortStayED: toNumber(
        fuzzyGet(row, ["percentage", "shortstay", "outpatient", "emergency"])
      ),
      longStayHosp: toNumber(
        fuzzyGet(row, ["hospitalizations", "1000", "longstay"]) ??
          fuzzyGet(row, ["hospitalizations", "per1000"])
      ),
      longStayED: toNumber(
        fuzzyGet(row, ["outpatient", "emergency", "1000", "longstay"]) ??
          fuzzyGet(row, ["emergencydepartmentvisits", "1000"])
      ),
    };
  };

  return {
    state: extract(stateRows),
    nation: extract(nationRows),
  };
}

/* ----------------------------------------------------------------
 * Top-level orchestrator
 * ---------------------------------------------------------------- */

/**
 * Fetch everything the report needs for a given CCN. Each piece is
 * fetched independently so a failure in the "bonus" datasets (claims
 * measures / state averages) never blocks the MVP fields from the
 * Provider Information dataset.
 *
 * @param {string} ccn
 * @returns {Promise<{providerInfo: Object, claimsMeasures: Object, averages: Object, warnings: string[]}>}
 */
async function fetchFacilityBundle(ccn) {
  const warnings = [];

  const providerInfo = await fetchProviderInfo(ccn); // let this one throw — it's required

  let claimsMeasures = {};
  try {
    claimsMeasures = await fetchClaimsMeasures(ccn);
  } catch (err) {
    warnings.push(
      "Hospitalization/ED claims measures could not be loaded (" + err.message + ")."
    );
  }

  let averages = { state: null, nation: null };
  try {
    if (providerInfo.state) {
      averages = await fetchStateAndNationalAverages(providerInfo.state);
    }
  } catch (err) {
    warnings.push(
      "State/national averages could not be loaded (" + err.message + ")."
    );
  }

  return { providerInfo, claimsMeasures, averages, warnings };
}
