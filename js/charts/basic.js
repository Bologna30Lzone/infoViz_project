import { sizeOf, makeSVG, randData } from './index.js';

export function chartLine(container, d3){
  if (!d3) return { dispose(){} };
  const {width, height} = sizeOf(container, 360, 220);
  const m = {top: 16, right: 16, bottom: 24, left: 36}, w = width-m.left-m.right, h = height-m.top-m.bottom;
  const data = randData(d3, 80, 7, 0.35);
  const x = d3.scaleLinear().domain(d3.extent(data, d=>d.x)).range([0,w]);
  const y = d3.scaleLinear().domain([0,1]).nice().range([h,0]);
  const svg = makeSVG(d3, container, width, height);
  const g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  g.append('g').attr('transform',`translate(0,${h})`).attr('class','axis').call(d3.axisBottom(x).ticks(6));
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(5));
  const line = d3.line().x(d=>x(d.x)).y(d=>y(d.y));
  g.append('path').datum(data).attr('fill','none').attr('stroke','#111').attr('stroke-width',2).attr('d',line);
  return { dispose(){ svg.remove(); } };
}

export function chartBar(container, d3){
  if (!d3) return { dispose(){} };
  const {width, height} = sizeOf(container, 360, 220);
  const m = {top: 16, right: 16, bottom: 24, left: 36}, w = width-m.left-m.right, h = height-m.top-m.bottom;
  const data = d3.range(24).map(i=>({x:i, y: Math.max(0, d3.randomNormal(0.6, 0.18)())}));
  const x = d3.scaleBand().domain(data.map(d=>d.x)).range([0,w]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(data, d=>d.y)||1]).nice().range([h,0]);
  const svg = makeSVG(d3, container, width, height);
  const g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  g.append('g').attr('transform',`translate(0,${h})`).attr('class','axis')
    .call(d3.axisBottom(x).tickValues(x.domain().filter((d,i)=>i%3===0)));
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(5));
  g.selectAll('rect').data(data).join('rect')
    .attr('x',d=>x(d.x)).attr('y',d=>y(d.y))
    .attr('width',x.bandwidth()).attr('height',d=>h - y(d.y))
    .attr('fill','#e11d48');
  return { dispose(){ svg.remove(); } };
}

export function chartArea(container, d3){
  if (!d3) return { dispose(){} };
  const {width, height} = sizeOf(container, 360, 220);
  const m = {top: 16, right: 16, bottom: 24, left: 36}, w = width-m.left-m.right, h = height-m.top-m.bottom;
  const data = randData(d3, 90, 11, 0.25);
  const x = d3.scaleLinear().domain(d3.extent(data, d=>d.x)).range([0,w]);
  const y = d3.scaleLinear().domain([0,1]).nice().range([h,0]);
  const svg = makeSVG(d3, container, width, height);
  const g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  g.append('g').attr('transform',`translate(0,${h})`).attr('class','axis').call(d3.axisBottom(x).ticks(6));
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(5));
  const area = d3.area().x(d=>x(d.x)).y0(y(0)).y1(d=>y(d.y));
  g.append('path').datum(data).attr('fill','#fee2e2').attr('stroke','#e11d48').attr('stroke-width',2).attr('d',area);
  return { dispose(){ svg.remove(); } };
}

export function chartSpark(container, d3){
  if (!d3) return { dispose(){} };
  const {width, height} = sizeOf(container, 240, 120);
  const m = {top: 6, right: 6, bottom: 18, left: 28}, w = width-m.left-m.right, h = height-m.top-m.bottom;
  const a = randData(d3, 100, 9, 0.35);
  const b = randData(d3, 100, 13, 0.28);
  const x = d3.scaleLinear().domain(d3.extent(a, d=>d.x)).range([0,w]);
  const y = d3.scaleLinear().domain([0,1]).range([h,0]);
  const svg = makeSVG(d3, container, width, height);
  const g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  g.append('g').attr('transform',`translate(0,${h})`).attr('class','axis').call(d3.axisBottom(x).ticks(5)).selectAll('text').style('font-size','10px');
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(4)).selectAll('text').style('font-size','10px');
  const line = d3.line().x(d=>x(d.x)).y(d=>y(d.y));
  g.append('path').datum(b).attr('fill','none').attr('stroke','#ef4444').attr('stroke-width',2).attr('d', line);
  g.append('path').datum(a).attr('fill','none').attr('stroke','#111').attr('stroke-width',2).attr('opacity',0.9).attr('d', line);
  return { dispose(){ svg.remove(); } };
}
