/**
 * export.js
 * ---------------------------------------------------------------
 * Builds the downloadable report in two formats:
 *   - generatePdfReport(report)  -> jsPDF + jspdf-autotable (CDN)
 *   - generateDocxReport(report) -> [Bonus] Word-compatible .doc
 *                                    via an HTML Blob (no heavy
 *                                    docx library required; opens
 *                                    natively in Microsoft Word).
 *
 * `report` is the object returned by buildReportData() in app.js.
 * ---------------------------------------------------------------
 */

const BRAND_COLORS = {
  magenta: [214, 36, 159], // #D6249F
  blue: [43, 169, 224], // #2BA9E0
  navy: [27, 42, 74], // #1B2A4A
  lightGray: [242, 244, 248],
};

const MAIN_FIELD_ROWS = [
  ["Name of Facility", (r) => r.facilityName],
  ["Location", (r) => r.location],
  ["EMR", (r) => r.emr],
  ["Census Capacity", (r) => r.censusCapacity],
  ["Current Census", (r) => r.currentCensus],
  ["Type of Patient", (r) => r.typeOfPatient],
  ["Previous Coverage from Medelite", (r) => r.previousCoverage],
  ["Previous Provider Performance from Medelite", (r) => r.previousProviderPerformance],
  ["Medical Coverage", (r) => r.medicalCoverage],
];

const RATING_ROWS = [
  ["Overall Star Rating", (r) => r.ratings.overall],
  ["Health Inspection", (r) => r.ratings.healthInspection],
  ["Staffing", (r) => r.ratings.staffing],
  ["Quality of Resident Care", (r) => r.ratings.qualityOfResidentCare],
];

function ratingDisplay(value) {
  return value === null || value === undefined ? "N/A" : `${value} / 5`;
}

function fileSafeName(name) {
  return (name || "facility")
    .toString()
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/* ----------------------------------------------------------------
 * PDF export
 * ---------------------------------------------------------------- */

function generatePdfReport(report) {
  if (typeof window.jspdf === "undefined") {
    throw new Error("jsPDF did not load — check your internet connection.");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // --- Branding header band -------------------------------------------
  doc.setFillColor(...BRAND_COLORS.navy);
  doc.rect(0, 0, pageWidth, 70, "F");

  doc.setTextColor(...BRAND_COLORS.magenta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(CONFIG.BRAND.PLATFORM_NAME, margin, 32);

  doc.setTextColor(...BRAND_COLORS.blue);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(CONFIG.BRAND.MANAGED_BY, margin, 50);

  // --- Title --------------------------------------------------------
  let y = 95;
  doc.setTextColor(...BRAND_COLORS.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(CONFIG.BRAND.REPORT_TITLE, margin, y);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(report.state ? `State: ${report.state}` : "State: —", pageWidth - margin, y, {
    align: "right",
  });

  y += 20;

  // --- Main facility/operational fields -------------------------------
  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Field", "Value"]],
    body: MAIN_FIELD_ROWS.map(([label, getter]) => [label, String(getter(report) ?? "—")]),
    theme: "grid",
    headStyles: { fillColor: BRAND_COLORS.navy, textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 220 } },
    styles: { fontSize: 10, cellPadding: 5 },
  });

  // --- Star ratings -----------------------------------------------------
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 14,
    margin: { left: margin, right: margin },
    head: [["CMS Quality Rating", "Score"]],
    body: RATING_ROWS.map(([label, getter]) => [label, ratingDisplay(getter(report))]),
    theme: "grid",
    headStyles: { fillColor: BRAND_COLORS.magenta, textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 220 } },
    styles: { fontSize: 10, cellPadding: 5 },
  });

  // --- Hospitalization / ED metrics --------------------------------------
  const hospRows = report.hospitalization && report.hospitalization.length
    ? report.hospitalization
    : [];

  if (hospRows.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 14,
      margin: { left: margin, right: margin },
      head: [["Hospitalization & ED Utilization", "Value"]],
      body: hospRows.map((row) => [
        row.label,
        row.value === null ? "—" : row.fmt(row.value),
      ]),
      theme: "grid",
      headStyles: { fillColor: BRAND_COLORS.blue, textColor: 255 },
      columnStyles: { 0: { cellWidth: 280 } },
      styles: { fontSize: 9, cellPadding: 4 },
    });
  }

  // --- Footer: Medicare source hyperlink ----------------------------------
  const finalY = doc.lastAutoTable.finalY + 24;
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.navy);
  doc.text("Source: Medicare Care Compare —", margin, finalY);
  doc.setTextColor(...BRAND_COLORS.blue);
  doc.textWithLink(report.careCompareUrl, margin + 140, finalY, { url: report.careCompareUrl });

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text(
    `Generated ${new Date().toLocaleString()} · CCN ${report.ccn || "—"}`,
    margin,
    finalY + 16
  );

  doc.save(`${fileSafeName(report.facilityName)}_facility_assessment_snapshot.pdf`);
}

/* ----------------------------------------------------------------
 * Word (.doc) export — bonus
 * ---------------------------------------------------------------- */

function generateDocxReport(report) {
  const escapeHtml = (val) =>
    String(val ?? "—")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const fieldRows = MAIN_FIELD_ROWS.map(
    ([label, getter]) =>
      `<tr><td style="font-weight:bold;width:45%;">${escapeHtml(label)}</td><td>${escapeHtml(
        getter(report)
      )}</td></tr>`
  ).join("");

  const ratingRows = RATING_ROWS.map(
    ([label, getter]) =>
      `<tr><td style="font-weight:bold;width:45%;">${escapeHtml(label)}</td><td>${escapeHtml(
        ratingDisplay(getter(report))
      )}</td></tr>`
  ).join("");

  const hospRows = (report.hospitalization || [])
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.label)}</td><td>${
          row.value === null ? "—" : escapeHtml(row.fmt(row.value))
        }</td></tr>`
    )
    .join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>Facility Assessment Snapshot</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; color: #1B2A4A; }
      h1 { color: #D6249F; margin-bottom: 0; }
      h2 { color: #2BA9E0; margin-top: 0; font-weight: normal; }
      h3 { background: #1B2A4A; color: #fff; padding: 6px 10px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
      td, th { border: 1px solid #ccc; padding: 6px 8px; font-size: 11pt; text-align: left; }
      a { color: #2BA9E0; }
    </style>
    </head>
    <body>
      <h1>${CONFIG.BRAND.PLATFORM_NAME}</h1>
      <h2>${CONFIG.BRAND.MANAGED_BY}</h2>
      <h3>${CONFIG.BRAND.REPORT_TITLE} — ${escapeHtml(report.state || "—")}</h3>

      <table>${fieldRows}</table>

      <h3>CMS Quality Ratings</h3>
      <table>${ratingRows}</table>

      ${
        hospRows
          ? `<h3>Hospitalization &amp; ED Utilization</h3><table>${hospRows}</table>`
          : ""
      }

      <p>Source: Medicare Care Compare —
        <a href="${report.careCompareUrl}">${report.careCompareUrl}</a>
      </p>
      <p style="color:#888; font-size:9pt;">
        Generated ${new Date().toLocaleString()} · CCN ${escapeHtml(report.ccn)}
      </p>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileSafeName(report.facilityName)}_facility_assessment_snapshot.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
