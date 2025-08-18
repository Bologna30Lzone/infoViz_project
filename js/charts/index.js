// Lazy D3 import shared by all charts (cached)
let d3Promise;
export function getD3(){
  if (!d3Promise) d3Promise = import('https://cdn.jsdelivr.net/npm/d3@7/+esm').catch(() => null);
  return d3Promise;
}

// Common helpers available to charts
export function sizeOf(el, fallbackW = 400, fallbackH = 200){
  const r = el.getBoundingClientRect();
  return { width: Math.max(40, r.width || fallbackW), height: Math.max(40, r.height || fallbackH) };
}
export function makeSVG(d3, container, w, h){
  return d3.select(container).append('svg').attr('width', w).attr('height', h);
}
export function randData(d3, n=60, f=10, amp=0.4){
  return d3.range(n).map(i=>({x:i, y: 0.5 + amp*Math.sin(i/f) + (Math.random()-0.5)*0.15}));
}

// Register charts
import { chartLine, chartBar, chartArea, chartSpark } from './basic.js';
import { chartBikeLine } from './bikeLine.js';

const registry = {
  line: chartLine,
  bar: chartBar,
  area: chartArea,
  spark: chartSpark,
  'bike-line': chartBikeLine,
};

// Public API for carousel to mount/unmount
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
