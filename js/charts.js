/**
 * charts.js
 * ---------------------------------------------------------------
 * [Bonus] Renders two grouped bar charts comparing this facility's
 * short-stay and long-stay hospitalization/ED metrics against the
 * state and national averages, using Chart.js (loaded via CDN).
 *
 * `rows` is the 12-item array produced by buildHospitalizationRows()
 * in app.js, always in this fixed order:
 *   0 STR Hosp (facility)   1 STR Hosp (national)   2 STR Hosp (state)
 *   3 STR ED   (facility)   4 STR ED   (national)   5 STR ED   (state)
 *   6 LT Hosp  (facility)   7 LT Hosp  (national)   8 LT Hosp  (state)
 *   9 LT ED    (facility)  10 LT ED    (national)  11 LT ED    (state)
 * ---------------------------------------------------------------
 */

const CHART_COLORS = {
  facility: "#D6249F", // brand magenta
  national: "#2BA9E0", // brand blue
  state: "#8C97AD", // neutral slate
};

let _strChart = null;
let _ltChart = null;

function destroyCharts() {
  if (_strChart) {
    _strChart.destroy();
    _strChart = null;
  }
  if (_ltChart) {
    _ltChart.destroy();
    _ltChart = null;
  }
}

function val(rows, i) {
  const v = rows?.[i]?.value;
  return v === null || v === undefined ? 0 : v;
}

/**
 * @param {HTMLElement} container - element to render the chart canvases into
 * @param {Array} rows - 12-item hospitalization rows array
 */
function renderHospChart(container, rows) {
  destroyCharts();
  container.innerHTML = "";

  if (typeof Chart === "undefined") {
    container.innerHTML =
      '<p class="chart-fallback">Chart.js did not load — check your internet connection.</p>';
    return;
  }

  const wrap1 = document.createElement("div");
  wrap1.className = "chart-box";
  const title1 = document.createElement("h4");
  title1.textContent = "Short-Stay (%)";
  const canvas1 = document.createElement("canvas");
  wrap1.appendChild(title1);
  wrap1.appendChild(canvas1);

  const wrap2 = document.createElement("div");
  wrap2.className = "chart-box";
  const title2 = document.createElement("h4");
  title2.textContent = "Long-Stay (per 1,000 resident days)";
  const canvas2 = document.createElement("canvas");
  wrap2.appendChild(title2);
  wrap2.appendChild(canvas2);

  container.appendChild(wrap1);
  container.appendChild(wrap2);

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 14, font: { size: 11 } } },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  _strChart = new Chart(canvas1.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Hospitalization", "ED Visit"],
      datasets: [
        {
          label: "This Facility",
          backgroundColor: CHART_COLORS.facility,
          data: [val(rows, 0), val(rows, 3)],
        },
        {
          label: "National Avg.",
          backgroundColor: CHART_COLORS.national,
          data: [val(rows, 1), val(rows, 4)],
        },
        {
          label: "State Avg.",
          backgroundColor: CHART_COLORS.state,
          data: [val(rows, 2), val(rows, 5)],
        },
      ],
    },
    options: sharedOptions,
  });

  _ltChart = new Chart(canvas2.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Hospitalization", "ED Visit"],
      datasets: [
        {
          label: "This Facility",
          backgroundColor: CHART_COLORS.facility,
          data: [val(rows, 6), val(rows, 9)],
        },
        {
          label: "National Avg.",
          backgroundColor: CHART_COLORS.national,
          data: [val(rows, 7), val(rows, 10)],
        },
        {
          label: "State Avg.",
          backgroundColor: CHART_COLORS.state,
          data: [val(rows, 8), val(rows, 11)],
        },
      ],
    },
    options: sharedOptions,
  });
}
