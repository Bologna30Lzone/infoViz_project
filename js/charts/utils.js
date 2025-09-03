// js/charts/utils.js
export function sizeOf(el, fallbackW = 400, fallbackH = 200){
  const r = el.getBoundingClientRect?.() || { width: fallbackW, height: fallbackH };
  return { width: Math.max(40, r.width || fallbackW), height: Math.max(40, r.height || fallbackH) };
}
export function makeSVG(d3, container, w, h){
  return d3.select(container).append('svg').attr('width', w).attr('height', h);
}
export function randData(d3, n=60, f=10, amp=0.4){
  return d3.range(n).map(i=>({x:i, y: 0.5 + amp*Math.sin(i/f) + (Math.random()-0.5)*0.15}));
}
