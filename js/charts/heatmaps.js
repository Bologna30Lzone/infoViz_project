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
  const panel = container.closest('.panel') || document;

  // 1) Target the pre-existing canvas
  const lineCanvas = panel.querySelector('#streetChart');
  if (!lineCanvas) {
    console.warn('[heatmaps] #streetChart canvas not found in this panel');
    return { dispose() {} };
  }
  if (!lineCanvas.style.height) lineCanvas.style.height = '36vh';

  // 2) Data URL (can be overridden by data-flow-url on the container)
  const flowURL =
    container.dataset.flowUrl || './data/flusso_per_html_veicoli_per_trimestri.csv';

  // 3) Helpers
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const roundUp = (n, step = 50) => Math.ceil((n || 0) / step) * step;

  // 4) Build the chart with two datasets:
  //    - Average across all streets (red) — always visible
  //    - Selected street (blue) — overlays when a street is clicked
  const ctx = lineCanvas.getContext('2d');

  // We'll set y.min / y.max only after we scan the CSV once.
  let fixedYMin = 0;   // keep baseline at zero (stable visual comparison)
  let fixedYMax = null;

  const lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'City-wide Average',
          data: [],
          borderColor: 'red',
          backgroundColor: 'rgba(255,0,0,0.15)',
          fill: false,
          tension: 0,
          pointRadius: 2,
          order: 1 // draw above grid
        },
        {
          label: 'Select a Road',
          data: [],
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.15)',
          fill: false,
          tension: 0,
          pointRadius: 2,
          order: 2 // draw on top of average
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          // Ensure our custom tick formatter is applied to every category
          ticks: {
            autoSkip: true,
            callback: function (value) {
              const labels = this.chart?.data?.labels || [];
              const raw = String(labels[value] ?? '');
              return raw.length >= 5 ? '' : raw;  // hide labels with 5+ characters
            }
          },
          grid: { display: true }
        },
        y: {
          beginAtZero: true,
          // min/max will be injected after CSV scan to keep the scale fixed:
          // min: fixedYMin,
          // max: fixedYMax,
        }
      },
      // Prevent animations from trying to rescale axes on dataset change
      animation: {
        duration: 250
      }
    }
  });

  // 5) Load CSV once and prepare:
  //    - avgOrders / avgLabels / avgValues  (ALL-STREETS average aligned by `order`)
  //    - seriesByStreet: Map(normalizedName → aligned values array)
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
        }
      });
    });
  }

  (async () => {
    try {
      const rows = await loadCSV(flowURL);

      // --- Compute global Y scale from ALL values so it's fixed across selections ---
      let globalMax = 0;
      for (const r of rows) {
        const v = Number(r.tot_day ?? 0);
        if (Number.isFinite(v)) globalMax = Math.max(globalMax, v);
      }
      fixedYMin = 0;
      fixedYMax = roundUp(globalMax, 50); // round to a "nice" step (adjust as needed)

      // Inject fixed y scale
      lineChart.options.scales.y.min = fixedYMin;
      lineChart.options.scales.y.max = fixedYMax;

      // --- Build ALL-STREETS average grouped by `order` ---
      const aggByOrder = new Map(); // order → { sum, count, label }
      for (const r of rows) {
        const ord = Number(r.order ?? 0);
        if (!aggByOrder.has(ord)) aggByOrder.set(ord, { sum: 0, count: 0, label: r.label });
        const a = aggByOrder.get(ord);
        a.sum += Number(r.tot_day ?? 0);
        a.count += 1;
        if (!a.label && r.label) a.label = r.label; // fallback if needed
      }
      avgOrders = Array.from(aggByOrder.keys()).sort((a, b) => a - b);
      const avgLabels = avgOrders.map((o) => aggByOrder.get(o).label ?? String(o));
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
        const aligned = avgOrders.map((o) => (omap.has(o) ? omap.get(o) : null));
        seriesByStreet.set(k, aligned);
      }

      // --- Seed the chart with the average (red) only ---
      lineChart.data.labels = avgLabels;
      lineChart.data.datasets[0].data = avgValues; // average
      lineChart.data.datasets[1].data = new Array(avgValues.length).fill(null); // no street yet
      lineChart.update();
    } catch (err) {
      console.warn('[heatmaps] CSV load error:', err);
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
    lineChart.data.datasets[1].label = street || 'Strada selezionata';

    if (aligned && aligned.length === lineChart.data.labels.length) {
      lineChart.data.datasets[1].data = aligned;
    } else {
      // No series found: keep previous data but still relabel
      console.warn('[heatmaps] No series found for street:', street);
    }

    // IMPORTANT: do NOT modify y.min/y.max here — they stay fixed.
    try {
      lineChart.update();
    } catch (e) {
      console.warn('[heatmaps] chart update failed', e);
    }

    // Optional: reflect selection in panel text
    const text = panel.querySelector('#text-content');
    if (text) text.textContent = `Selezionata: ${street}`;
  };
  window.addEventListener('message', onMessage);

  // 7) Optional in-panel map toggles (if present in your markup)
  const mapButtons = panel.querySelectorAll('.map-selector [data-map]');
  const mapFrames = panel.querySelectorAll('.map-frame');
  const onMapClick = (e) => {
    const id = e.currentTarget.getAttribute('data-map');
    mapButtons.forEach((b) => b.toggleAttribute('aria-pressed', b === e.currentTarget));
    mapFrames.forEach((f) => f.classList.toggle('active', f.id === id));
  };
  mapButtons.forEach((b) => b.addEventListener('click', onMapClick));

  // 8) Lifecycle for carousel/unmount
  return {
    dispose() {
      aborted = true;
      window.removeEventListener('message', onMessage);
      mapButtons.forEach((b) => b.removeEventListener('click', onMapClick));
      try {
        lineChart?.destroy();
      } catch {}
    }
  };
}
