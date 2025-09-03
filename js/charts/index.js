// js/charts/index.js — UPDATED to avoid circular imports
let d3Promise;
export function getD3(){
  if (!d3Promise) d3Promise = import('https://cdn.jsdelivr.net/npm/d3@7/+esm').catch(() => null);
  return d3Promise;
}

// Re-export helpers so older modules that import from './index.js' still work
export { sizeOf, makeSVG, randData } from './utils.js';

// Built-ins
import { chartLine, chartBar, chartArea, chartSpark } from './basic.js';

// Registered custom modules
import { chartAirQuality } from './airQuality.js';
import { chartEVShare }    from './evShare.js';
import { chartBikeLine }   from './bikeLine.js';
import { chartHeatmaps } from './heatmaps.js';

const registry = {
  line: chartLine,
  bar: chartBar,
  area: chartArea,
  spark: chartSpark,
  'air-quality': chartAirQuality,
  'ev-share':    chartEVShare,
  'bike-line':   chartBikeLine,
  'heatmaps': chartHeatmaps,
};

export async function mountChartsIn(panel){
  const d3 = await getD3();
  const charts = panel.querySelectorAll('.chart[data-type]');
  charts.forEach(el => {
    if (el._dispose) return;
    const type = (el.dataset.type || 'line').toLowerCase();
    const factory = registry[type] || chartLine;
    el._dispose = factory(el, d3);
  });
}
export function unmountChartsIn(panel){
  panel.querySelectorAll('.chart[data-type]').forEach(el => { el._dispose?.dispose?.(); el._dispose = null; });
}