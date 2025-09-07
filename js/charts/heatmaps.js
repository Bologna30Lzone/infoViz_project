// js/charts/heatmaps.js
// Renders ONLY the street time-series into the existing <canvas id="streetChart">.
// • Preloads CSV once, builds an ALL-STREETS average (red) across time (2019–2025).
// • Listens for postMessage({ street: "<name>" }) from map iframes and overlays
//   the selected street series (blue) alongside the average.
// • Uses the existing DOM (no new canvases), fits your carousel mount/unmount.
//
// CSV expected at ./data/flusso_per_html_veicoli_per_trimestri.csv  (overridable via data-flow-url)
// Columns used: stname, order, label ("YYYY-1"/"YYYY-2"), period (1/2), tot_day (number)

export function chartHeatmaps(container /* d3 not required */) {
  const panel = container.closest(".panel") || document;

  // 1) Target the pre-existing canvas
  const lineCanvas = panel.querySelector("#streetChart");
  if (!lineCanvas) {
    console.warn("[heatmaps] #streetChart canvas not found in this panel");
    return { dispose() {} };
  }
  if (!lineCanvas.style.height) lineCanvas.style.height = "36vh";

  // 2) Data URL (can be overridden by data-flow-url on the container)
  const flowURL =
    container.dataset.flowUrl ||
    "./data/flusso_per_html_veicoli_per_trimestri.csv";

  // 3) Helpers
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  // “nice” ceiling to 1–2–2.5–5–10 × 10^k
  function niceCeil(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    const f = value / base; // in [1,10)
    let nf;
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 2.5) nf = 2.5;
    else if (f <= 5) nf = 5;
    else nf = 10;
    return nf * base;
  }

  // Turn "2019-1" / "20192" into "2019-H1" (and "...-H2") — for tooltips
  const formatHalfLabel = (label) => {
    const s = String(label || "");
    const m = s.match(/^(\d{4})[-\s]?([12])$/); // matches "2019-1", "2019 2", "20192"
    if (m) return `${m[1]}-H${m[2]}`;
    return s;
  };

  // 4) Build the chart with two datasets:
  //    - Average across all streets (red) — always visible
  //    - Selected street (blue) — overlays when a street is clicked
  const ctx = lineCanvas.getContext("2d");

  // We'll set y.min / y.max only after we scan the CSV once.
  let fixedYMin = 0;
  let fixedYMax = null;
  let fixedYStep = null;

  // Custom plugin to draw the "città30" label
  const citta30Plugin = {
    id: "citta30Label",
    afterDraw: function (chart) {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;

      // Find gray area start position
      let grayStartIndex = -1;
      const labels = chart.data.labels;
      for (let i = 0; i < labels.length; i++) {
        // Check if we have a background dataset with data at this position
        const backgroundDataset = chart.data.datasets.find(
          (ds) => ds.order === 3
        );
        if (backgroundDataset && backgroundDataset.data[i] !== null) {
          grayStartIndex = i;
          break;
        }
      }

      if (grayStartIndex >= 0) {
        const xScale = chart.scales.x;

        // Calculate position for the label
        const startX = xScale.getPixelForValue(grayStartIndex);
        const endX = chartArea.right;
        const labelX = startX + (endX - startX) / 2; // Center of gray area
        const labelY = chartArea.top + 20; // Near the top

        // Draw the label
        ctx.save();
        ctx.fillStyle = "#666";
        ctx.font = "bold 14px IBM Plex Mono";
        ctx.textAlign = "center";
        ctx.fillText("Città 30", labelX, labelY);
        ctx.restore();
      }
    },
  };

  const lineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "City-wide Average",
          data: [],
          borderColor: "#C81515",
          backgroundColor: "rgba(255,0,0,0.15)",
          fill: false,
          tension: 0,
          pointRadius: 2,
          order: 1,
        },
        {
          label: "", // empty so it's filtered out of legend when no data
          data: [],
          borderColor: "#00916E",
          backgroundColor: "rgba(54, 162, 235, 0.15)",
          fill: false,
          tension: 0,
          pointRadius: 2,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'none' }, // Disable all interactions
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#000831",
            // Hide the street-specific dataset from legend when it has only nulls or empty label
            // Also hide background area dataset
            filter: function (legendItem, chartData) {
              const ds = chartData.datasets[legendItem.datasetIndex];
              if (!ds || !ds.data) return false;
              if (!ds.label) return false;
              // Hide background area dataset (order: 3)
              if (ds.order === 3) return false;
              return ds.data.some((v) => v != null);
            },
          },
        },
        tooltip: {
          enabled: false // Disable tooltips
        },
      },
      scales: {
        x: {
          // Keep axis labels as-is; hide long ones if needed
          ticks: {
            autoSkip: true,
            color: "#000831",
            callback: function (value) {
              const labels = this.chart?.data?.labels || [];
              const raw = String(labels[value] ?? "");
              return raw.length >= 5 ? "" : raw; // hide labels with 5+ characters
            },
          },
          grid: { 
            display: true,
            drawOnChartArea: false, // Don't draw grid lines across the chart
            tickLength: 5,
            tickColor: "#000831"
          },
          border: { color: "#000831" },
        },
        y: {
          beginAtZero: true,
          // min/max/step are injected after CSV scan to enforce even spacing incl. top label
          // min: fixedYMin,
          // max: fixedYMax,
          ticks: {
            // stepSize: fixedYStep,
            color: "#000831",
            callback: function (val) {
              return Number.isFinite(val) ? val : val;
            },
          },
          grid: { 
            display: true,
            drawOnChartArea: false, // Don't draw grid lines across the chart
            tickLength: 5,
            tickColor: "#000831"
          },
          border: { color: "#000831" },
        },
      },
      // Prevent animations from trying to rescale axes on dataset change
      animation: { duration: 250 },
    },
    plugins: [citta30Plugin],
  });

  // 5) Load CSV once and prepare data
  let aborted = false;
  let avgOrders = [];
  let seriesByStreet = new Map();

  function loadCSV(url) {
    return new Promise((resolve, reject) => {
      const rows = [];
      Papa.parse(url, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: () => resolve(rows),
        error: reject,
        step: (res) => {
          if (!aborted) rows.push(res.data);
        },
      });
    });
  }

  (async () => {
    try {
      const rows = await loadCSV(flowURL);

      // --- Compute global data max ---
      let globalMax = 0;
      for (const r of rows) {
        const v = Number(r.tot_day ?? 0);
        if (Number.isFinite(v)) globalMax = Math.max(globalMax, v);
      }

      // --- Decide tick count and compute a nice step & max so top label is included ---
      const desiredLabels = 6; // total labels: 0..max (change to taste)
      const intervals = Math.max(1, desiredLabels - 1);
      const rawStep = globalMax / intervals;
      fixedYStep = niceCeil(rawStep); // nice step >= raw step
      fixedYMin = 0;
      fixedYMax = fixedYStep * intervals; // ensures evenly spaced labels incl. top

      // Inject fixed y scale & ticks
      lineChart.options.scales.y.min = fixedYMin;
      lineChart.options.scales.y.max = fixedYMax;
      lineChart.options.scales.y.ticks.stepSize = fixedYStep;

      // --- Build ALL-STREETS average grouped by `order` ---
      const aggByOrder = new Map(); // order → { sum, count, label }
      for (const r of rows) {
        const ord = Number(r.order ?? 0);
        if (!aggByOrder.has(ord))
          aggByOrder.set(ord, { sum: 0, count: 0, label: r.label });
        const a = aggByOrder.get(ord);
        a.sum += Number(r.tot_day ?? 0);
        a.count += 1;
        if (!a.label && r.label) a.label = r.label;
      }
      avgOrders = Array.from(aggByOrder.keys()).sort((a, b) => a - b);
      const avgLabels = avgOrders.map(
        (o) => aggByOrder.get(o).label ?? String(o)
      );
      const avgValues = avgOrders.map((o) => {
        const a = aggByOrder.get(o);
        return a.count ? a.sum / a.count : null;
      });

      // --- Build per-street aligned series (to avgOrders) ---
      const tmpStreet = new Map(); // normName → Map(order → value)
      for (const r of rows) {
        const key = norm(r.stname);
        if (!key) continue;
        if (!tmpStreet.has(key)) tmpStreet.set(key, new Map());
        tmpStreet.get(key).set(Number(r.order ?? 0), Number(r.tot_day ?? 0));
      }
      seriesByStreet = new Map();
      for (const [k, omap] of tmpStreet) {
        const aligned = avgOrders.map((o) =>
          omap.has(o) ? omap.get(o) : null
        );
        seriesByStreet.set(k, aligned);
      }

      // --- Find the index where 2023-1 starts for gray background area ---
      let grayStartIndex = -1;
      for (let i = 0; i < avgOrders.length; i++) {
        if (avgOrders[i] >= 20232) {
          // 2023-1 corresponds to order 20231
          grayStartIndex = i;
          break;
        }
      }

      // --- Create background area data for gray shading from 2023-1 onwards ---
      let backgroundData = [];
      if (grayStartIndex >= 0) {
        backgroundData = avgLabels.map((label, index) => {
          if (index >= grayStartIndex) {
            return fixedYMax; // Fill to the top of the chart
          }
          return null;
        });
      }

      // --- Seed the chart with the average (red) only ---
      lineChart.data.labels = avgLabels;
      lineChart.data.datasets[0].data = avgValues; // average
      lineChart.data.datasets[1].data = new Array(avgValues.length).fill(null); // no street yet
      lineChart.data.datasets[1].label = ""; // empty → legend filter hides it

      // Add background area dataset if we found 2023-1
      if (grayStartIndex >= 0) {
        lineChart.data.datasets.push({
          label: "",
          data: backgroundData,
          backgroundColor: "rgba(200, 200, 200, 0.3)",
          borderColor: "transparent",
          fill: "origin",
          pointRadius: 0,
          order: 3, // Behind other datasets
          skipNull: true,
        });
      }

      lineChart.update();
    } catch (err) {
      console.warn("[heatmaps] CSV load error:", err);
    }
  })();

  // 6) Handle messages from map iframes: { street: "<name>" }
  const onMessage = (ev) => {
    const data = ev?.data;
    if (!data || !data.street) return;

    const street = String(data.street).trim();
    const key = norm(street);
    const aligned = seriesByStreet.get(key);

    // Dataset[1] is the street overlay (blue), Dataset[0] is the average (red)
    if (
      aligned &&
      aligned.length === lineChart.data.labels.length &&
      aligned.some((v) => v != null)
    ) {
      lineChart.data.datasets[1].label = street || "Strada selezionata";
      lineChart.data.datasets[1].data = aligned;
    } else {
      // CLEAR the street-specific line and hide it from legend via filter
      lineChart.data.datasets[1].label = "";
      lineChart.data.datasets[1].data = new Array(
        lineChart.data.labels.length
      ).fill(null);
    }

    try {
      lineChart.update();
    } catch (e) {
      console.warn("[heatmaps] chart update failed", e);
    }

    // Optional: reflect selection in panel text
    const text = panel.querySelector("#text-content");
    if (text) {
      text.textContent = lineChart.data.datasets[1].label
        ? `Selezionata: ${street}`
        : "Nessuna strada selezionata o dati non disponibili";
    }
  };
  window.addEventListener("message", onMessage);

  // 7) Map/year toggles (buttons + frames). Add "active" to the pressed year button.
  const mapButtons = panel.querySelectorAll(".map-selector [data-map]");
  const mapFrames = panel.querySelectorAll(".map-frame");

  const onMapClick = (e) => {
    const btn = e.currentTarget;
    const id = btn.getAttribute("data-map");

    // Toggle button states
    mapButtons.forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle("active", isActive);
      b.toggleAttribute("aria-pressed", isActive);
    });

    // Toggle visible iframe
    mapFrames.forEach((f) => f.classList.toggle("active", f.id === id));

    // Optional: update <figcaption> with the selected year text
    const cap = panel.querySelector("figure .caption");
    if (cap) {
      const label = btn.textContent.trim();
      cap.textContent = `› ${label} ‹`;
    }
  };

  mapButtons.forEach((b) => b.addEventListener("click", onMapClick));

  // 8) Lifecycle for carousel/unmount
  return {
    dispose() {
      aborted = true;
      window.removeEventListener("message", onMessage);
      mapButtons.forEach((b) => b.removeEventListener("click", onMapClick));
      try {
        lineChart?.destroy();
      } catch {}
    },
  };
}
