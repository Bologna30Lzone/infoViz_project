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
    const f = value / base;
    let nf;
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 2.5) nf = 2.5;
    else if (f <= 5) nf = 5;
    else nf = 10;
    return nf * base;
  }

  const formatHalfLabel = (label) => {
    const s = String(label || "");
    const m = s.match(/^(\d{4})[-\s]?([12])$/); 
    if (m) return `${m[1]}-H${m[2]}`;
    return s;
  };


  const ctx = lineCanvas.getContext("2d");

  let fixedYMin = 0;
  let fixedYMax = null;
  let fixedYStep = null;

  const citta30Plugin = {
    id: "citta30Label",
    afterDraw: function (chart) {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;

      let grayStartIndex = -1;
      const labels = chart.data.labels;
      for (let i = 0; i < labels.length; i++) {
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

        const startX = xScale.getPixelForValue(grayStartIndex);
        const endX = chartArea.right;
        const labelX = startX + (endX - startX) / 2; 
        const labelY = chartArea.top + 20; 

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
          label: "", 
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
      interaction: { mode: "none" },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#000831",
            filter: function (legendItem, chartData) {
              const ds = chartData.datasets[legendItem.datasetIndex];
              if (!ds || !ds.data) return false;
              if (!ds.label) return false;
              if (ds.order === 3) return false;
              return ds.data.some((v) => v != null);
            },
          },
        },
        tooltip: {
          enabled: false,
        },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            color: "#000831",
            callback: function (value) {
              const labels = this.chart?.data?.labels || [];
              const raw = String(labels[value] ?? "");
              return raw.length >= 5 ? "" : raw;
            },
          },
          grid: {
            display: true,
            drawOnChartArea: false,
            tickLength: 5,
            tickColor: "#000831",
          },
          border: { color: "#000831" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#000831",
            callback: function (val) {
              return Number.isFinite(val) ? val : val;
            },
          },
          grid: {
            display: true,
            drawOnChartArea: false,
            tickLength: 5,
            tickColor: "#000831",
          },
          border: { color: "#000831" },
        },
      },
      animation: { duration: 250 },
    },
    plugins: [citta30Plugin],
  });


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

      let globalMax = 0;
      for (const r of rows) {
        const v = Number(r.tot_day ?? 0);
        if (Number.isFinite(v)) globalMax = Math.max(globalMax, v);
      }

      const desiredLabels = 6; 
      const intervals = Math.max(1, desiredLabels - 1);
      const rawStep = globalMax / intervals;
      fixedYStep = niceCeil(rawStep); 
      fixedYMin = 0;
      fixedYMax = fixedYStep * intervals; 

      lineChart.options.scales.y.min = fixedYMin;
      lineChart.options.scales.y.max = fixedYMax;
      lineChart.options.scales.y.ticks.stepSize = fixedYStep;

      const aggByOrder = new Map(); 
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

      const tmpStreet = new Map();
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

      let grayStartIndex = -1;
      for (let i = 0; i < avgOrders.length; i++) {
        if (avgOrders[i] >= 20232) {
          grayStartIndex = i;
          break;
        }
      }

      let backgroundData = [];
      if (grayStartIndex >= 0) {
        backgroundData = avgLabels.map((label, index) => {
          if (index >= grayStartIndex) {
            return fixedYMax; 
          }
          return null;
        });
      }

      lineChart.data.labels = avgLabels;
      lineChart.data.datasets[0].data = avgValues;
      lineChart.data.datasets[1].data = new Array(avgValues.length).fill(null);
      lineChart.data.datasets[1].label = "";

      if (grayStartIndex >= 0) {
        lineChart.data.datasets.push({
          label: "",
          data: backgroundData,
          backgroundColor: "rgba(200, 200, 200, 0.3)",
          borderColor: "transparent",
          fill: "origin",
          pointRadius: 0,
          order: 3,
          skipNull: true,
        });
      }

      lineChart.update();
    } catch (err) {
      console.warn("[heatmaps] CSV load error:", err);
    }
  })();

  const onMessage = (ev) => {
    const data = ev?.data;
    if (!data || !data.street) return;

    const street = String(data.street).trim();
    const key = norm(street);
    const aligned = seriesByStreet.get(key);

    if (
      aligned &&
      aligned.length === lineChart.data.labels.length &&
      aligned.some((v) => v != null)
    ) {
      lineChart.data.datasets[1].label = street || "Strada selezionata";
      lineChart.data.datasets[1].data = aligned;
    } else {
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

    const text = panel.querySelector("#text-content");
    if (text) {
      text.textContent = lineChart.data.datasets[1].label
        ? `Selezionata: ${street}`
        : "Nessuna strada selezionata o dati non disponibili";
    }
  };
  window.addEventListener("message", onMessage);

  const mapButtons = panel.querySelectorAll(".map-selector [data-map]");
  const mapFrames = panel.querySelectorAll(".map-frame");

  const onMapClick = (e) => {
    const btn = e.currentTarget;
    const id = btn.getAttribute("data-map");

    mapButtons.forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle("active", isActive);
      b.toggleAttribute("aria-pressed", isActive);
    });

    mapFrames.forEach((f) => f.classList.toggle("active", f.id === id));

    const cap = panel.querySelector("figure .caption");
    if (cap) {
      const label = btn.textContent.trim();
      cap.textContent = `› ${label} ‹`;
    }
  };

  mapButtons.forEach((b) => b.addEventListener("click", onMapClick));

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
