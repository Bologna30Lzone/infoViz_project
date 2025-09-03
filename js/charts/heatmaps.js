// js/charts/heatmaps.js
// Mounts a Chart.js line + bar viz, scoped to the panel that contains `container`.
// Expects global Chart and Papa (loaded via <script> in HTML).

export function chartHeatmaps(container /*, d3 not needed */) {
  const panel = container.closest('.panel') || document;

  // Allow per-instance data sources via data-* attributes on the .chart container
  const flowURL = container.dataset.flowUrl || '.../../data/flusso_per_html_veicoli_per_trimestri.csv';
  const compURL = container.dataset.compUrl || '../../data/df_30vsnon30.csv';

  // Find or create canvases inside this container (keeps things self-contained)
  const lineWrap = ensureSlot(container, '36vh');
  const barWrap  = ensureSlot(container, '36vh');

  const lineCanvas = lineWrap.querySelector('canvas') || lineWrap.appendChild(document.createElement('canvas'));
  const barCanvas  = barWrap.querySelector('canvas')  || barWrap.appendChild(document.createElement('canvas'));

  lineCanvas.id = lineCanvas.id || 'streetChart';
  barCanvas.id  = barCanvas.id  || 'chart';

  let lineChart = new Chart(lineCanvas.getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Serie', data: [] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  let barChart = new Chart(barCanvas.getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: '30 vs non-30', data: [] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Map toggles (panel-scoped)
  const mapButtons = panel.querySelectorAll('.map-selector [data-map]');
  const mapFrames  = panel.querySelectorAll('.map-frame');

  const onMapClick = (e) => {
    const id = e.currentTarget.getAttribute('data-map');
    mapButtons.forEach(b => b.toggleAttribute('aria-pressed', b === e.currentTarget));
    mapFrames.forEach(f => f.classList.toggle('active', f.id === id));
  };
  mapButtons.forEach(b => b.addEventListener('click', onMapClick));

  // Data loading via PapaParse (stream to arrays)
  let aborted = false;
  function loadCSV(url) {
    return new Promise((resolve, reject) => {
      const rows = [];
      Papa.parse(url, {
        download: true,
        dynamicTyping: true,
        complete: () => resolve(rows),
        error: reject,
        step: (res) => { if (!aborted) rows.push(res.data); }
      });
    });
  }

  (async () => {
    try {
      const flow = await loadCSV(flowURL);
      const comp = await loadCSV(compURL);

      // naive: first col = label, second = value (adjust if your CSV differs)
      const fLabels = flow.slice(1).map(r => r[0]);
      const fValues = flow.slice(1).map(r => Number(r[1] ?? 0));
      lineChart.data.labels = fLabels;
      lineChart.data.datasets[0].data = fValues;
      lineChart.update();

      const cLabels = comp.slice(1).map(r => r[0]);
      const cValues = comp.slice(1).map(r => Number(r[1] ?? 0));
      barChart.data.labels = cLabels;
      barChart.data.datasets[0].data = cValues;
      barChart.update();
    } catch (err) {
      console.warn('[heatmaps] CSV load error:', err);
    }
  })();

  // Optional: update from iframe messages (panel-scoped feedback)
  const onMessage = (ev) => {
    if (!ev?.data || !ev.data.street) return;
    const { street, series = [] } = ev.data;
    lineChart.data.labels = series.map(d => d.label ?? '');
    lineChart.data.datasets[0].data = series.map(d => Number(d.value ?? 0));
    lineChart.data.datasets[0].label = street;
    lineChart.update();

    const text = panel.querySelector('#text-content');
    if (text) text.textContent = `Selezionata: ${street}`;
  };
  window.addEventListener('message', onMessage);

  function ensureSlot(root, height = '36vh') {
    const slot = document.createElement('div');
    slot.style.height = height;
    slot.style.marginBlock = '6px';
    root.appendChild(slot);
    return slot;
  }

  // Lifecycle hook used by your carousel unmount
  return {
    dispose() {
      aborted = true;
      window.removeEventListener('message', onMessage);
      mapButtons.forEach(b => b.removeEventListener('click', onMapClick));
      try { lineChart?.destroy(); } catch {}
      try { barChart?.destroy(); } catch {}
      // keep DOM; the carousel will clear the container if needed
    }
  };
}
