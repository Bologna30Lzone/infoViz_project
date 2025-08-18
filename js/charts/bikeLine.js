// /js/charts/bikeLine.js
import { sizeOf, makeSVG } from './index.js';

let bikeDataCache = null; // cache CSV once loaded

export function chartBikeLine(container, d3){
  if (!d3) return { dispose(){} };

  const host = d3.select(container).classed('bike-chart', true);
  const { width, height } = sizeOf(container, 960, 500);
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  host.selectAll('*').remove();
  const svg = makeSVG(d3, container, width, height);
  const g = d3.select(svg.node()).append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const parseDate = d3.timeParse('%Y-%m-%d');
  const selectedStations = new Set(['Ercolani', 'Sabotino', 'San Donato']);
  const startDate = parseDate('2019-01-01');
  const markerDate = parseDate('2024-01-01');

  function aggregateSemiannual(rows){
    const filtered = rows
      .map(d => ({ date: parseDate(d.data), value: +d.totale, station: d.colonnina }))
      .filter(d => d.date && d.date >= startDate && d.value > 0 && selectedStations.has(d.station));

    const rolled = d3.rollups(
      filtered,
      v => d3.mean(v, d => d.value),
      d => {
        const y = d.date.getFullYear();
        const half = Math.floor(d.date.getMonth() / 6) + 1; // 1 or 2
        return `${y}-H${half}`;
      }
    ).map(([key, mean]) => {
      const [y, h] = key.split('-H');
      return { date: new Date(+y, (h - 1) * 6, 1), mean };
    });

    return rolled.sort((a, b) => d3.ascending(a.date, b.date));
  }

  function computeTrend(data){
    // simple OLS on semiannual points
    const xs = data.map(d => d.date.getTime());
    const ys = data.map(d => d.mean);
    const xm = d3.mean(xs), ym = d3.mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++){
      num += (xs[i] - xm) * (ys[i] - ym);
      den += (xs[i] - xm) ** 2;
    }
    const slope = den ? num / den : 0;
    const intercept = ym - slope * xm;

    const firstT = data[0].date.getTime();
    const lastT  = data[data.length - 1].date.getTime();
    return [
      { date: new Date(firstT), mean: intercept + slope * firstT },
      { date: new Date(lastT),  mean: intercept + slope * lastT  }
    ];
  }

  function render(rows){
    const data = aggregateSemiannual(rows);
    if (!data.length){
      g.append('text').attr('class','no-data').attr('x', 0).attr('y', 0).text('Nessun dato');
      return;
    }

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date))
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.mean)]).nice()
      .range([h, 0]);

    // Axes (6-month ticks, labeled H1/H2)
    const tickEvery6m = d3.timeMonth.every(6);
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .attr('class','axis')
      .call(d3.axisBottom(x)
        .ticks(tickEvery6m)
        .tickFormat(d => d.getMonth() === 0 ? `${d.getFullYear()} H1` : `${d.getFullYear()} H2`));

    g.append('g')
      .attr('class','axis')
      .call(d3.axisLeft(y));

    // Main line (animated reveal)
    const line = d3.line().x(d => x(d.date)).y(d => y(d.mean));

    const path = g.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('fill','none')
      .attr('stroke','steelblue')
      .attr('stroke-width',2)
      .attr('d', line);

    const totalLen = path.node().getTotalLength();
    path
      .attr('stroke-dasharray', `${totalLen} ${totalLen}`)
      .attr('stroke-dashoffset', totalLen)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Points (fade & grow)
    g.selectAll('circle.point')
      .data(data)
      .join('circle')
      .attr('class','point')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d.mean))
      .attr('r', 0)
      .attr('opacity', 0)
      .transition()
      .delay(300)
      .duration(500)
      .attr('r', 4)
      .attr('opacity', 1);

    // Dotted red trend line (fade-in)
    const trend = computeTrend(data);
    g.append('path')
      .datum(trend)
      .attr('fill','none')
      .attr('stroke','#e11d48')
      .attr('stroke-width',2)
      .attr('stroke-dasharray','6,4')
      .attr('opacity', 0)
      .attr('d', line)
      .transition()
      .delay(200)
      .duration(600)
      .attr('opacity', 1);

    // Città 30 marker (only if within x domain)
    const [xmin, xmax] = x.domain();
    if (markerDate >= xmin && markerDate <= xmax){
      const mx = x(markerDate);
      g.append('line')
        .attr('class','marker-line')
        .attr('x1', mx).attr('x2', mx)
        .attr('y1', 0).attr('y2', h);
      g.append('text')
        .attr('class','marker-label')
        .attr('x', mx + 5)
        .attr('y', -5)
        .text('Città 30');
    }
  }

  // Load data (cached)
  let alive = true;
  (async () => {
    try {
      if (!bikeDataCache) {
        bikeDataCache = await d3.csv('bike-trimmed.csv'); // keep this next to index.html
      }
      if (alive) render(bikeDataCache);
    } catch (err) {
      console.error('Errore:', err);
      g.append('text').attr('class','no-data').attr('x', 0).attr('y', 0).text('Errore nel caricamento dei dati.');
    }
  })();

  return {
    dispose(){
      alive = false;
      host.selectAll('*').remove();
    }
  };
}
