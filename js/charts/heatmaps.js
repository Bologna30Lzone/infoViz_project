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

  // 4) Build the chart
  const ctx = lineCanvas.getContext('2d');

  let fixedYMin = 0;
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
          order: 1
        },
        {
          label: 'Select a Road',
          data: [],
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.15)',
          fill: false,
          tension: 0,
          pointRadius: 2,
          order: 2
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
          ticks: {
            autoSkip: true,
            callback: function (value) {
              const labels = this.chart?.data?.labels || [];
              const raw = String(labels[value] ?? '');
              return raw.length >= 5 ? '' : raw;
            }
          },
          grid: { display: true }
        },
        y: {
          beginAtZero: true
        }
      },
      animation: {
        duration: 250
      }
    }
  });

  // 5) Load CSV and prepare data
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

      // --- Compute global Y scale ---
      let globalMax = 0;
      for (const r of rows) {
        const v = Number(r.tot_day ?? 0);
        if (Number.isFinite(v)) globalMax = Math.max(globalMax, v);
      }
      fixedYMin = 0;
      fixedYMax = roundUp(globalMax, 50);

      lineChart.options.scales.y.min = fixedYMin;
      lineChart.options.scales.y.max = fixedYMax;

      // --- Build ALL-STREETS average ---
      const aggByOrder = new Map();
      for (const r of rows) {
        const ord = Number(r.order ?? 0);
        if (!aggByOrder.has(ord)) aggByOrder.set(ord, { sum: 0, count: 0, label: r.label });
        const a = aggByOrder.get(ord);
        a.sum += Number(r.tot_day ?? 0);
        a.count += 1;
        if (!a.label && r.label) a.label = r.label;
      }
      avgOrders = Array.from(aggByOrder.keys()).sort((a, b) => a - b);
      const avgLabels = avgOrders.map((o) => aggByOrder.get(o).label ?? String(o));
      const avgValues = avgOrders.map((o) => {
        const a = aggByOrder.get(o);
        return a.count ? a.sum / a.count : null;
      });

      // --- Build per-street aligned series ---
      const tmpStreet = new Map();
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

      // --- Seed chart ---
      lineChart.data.labels = avgLabels;
      lineChart.data.datasets[0].data = avgValues;
      lineChart.data.datasets[1].data = new Array(avgValues.length).fill(null);
      lineChart.update();
    } catch (err) {
      console.warn('[heatmaps] CSV load error:', err);
    }
  })();

  // 6) Handle messages from map iframes
  const onMessage = (ev) => {
    const data = ev?.data;
    if (!data || !data.street) return;

    const street = String(data.street).trim();
    const key = norm(street);
    const aligned = seriesByStreet.get(key);

    lineChart.data.datasets[1].label = street || 'Strada selezionata';

    if (aligned && aligned.length === lineChart.data.labels.length) {
      lineChart.data.datasets[1].data = aligned;
    } else {
      console.warn('[heatmaps] No series found for street:', street);
    }

    try {
      lineChart.update();
    } catch (e) {
      console.warn('[heatmaps] chart update failed', e);
    }

    const text = panel.querySelector('#text-content');
    if (text) text.textContent = `Selezionata: ${street}`;
  };
  window.addEventListener('message', onMessage);

  // 7) Map toggles + update caption
  const mapButtons = panel.querySelectorAll('.map-selector [data-map]');
  const mapFrames = panel.querySelectorAll('.map-frame');
  const caption = panel.querySelector('figcaption.caption');

  const onMapClick = (e) => {
    const id = e.currentTarget.getAttribute('data-map');
    const year = e.currentTarget.id;

    mapButtons.forEach((b) => b.toggleAttribute('aria-pressed', b === e.currentTarget));
    mapFrames.forEach((f) => f.classList.toggle('active', f.id === id));

    if (caption && year) {
      caption.textContent = `› ${year} ‹`;
    }
  };

  mapButtons.forEach((b) => b.addEventListener('click', onMapClick));

  // 8) Lifecycle
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
