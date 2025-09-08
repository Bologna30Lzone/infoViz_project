// /js/charts/bikeLine.js
import { sizeOf, makeSVG } from "./index.js";

let bikeDataCache = null; // cache CSV once loaded

export function chartBikeLine(container, d3) {
  if (!d3) return { dispose() {} };

  const host = d3.select(container).classed("bike-chart", true);

  const { width, height } = sizeOf(container, 960, 500);
  console.log(width, height);
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  host.selectAll("*").remove();
  const svg = makeSVG(d3, container, width, height);
  const g = d3
    .select(svg.node())
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Add title
  g.append("text")
    .attr("class", "chart-title")
    .attr("x", w / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("fill", "#000831")
    .text("Semi-annual average bike traffic");

  const parseDate = d3.timeParse("%Y-%m-%d");
  const selectedStations = new Set(["Ercolani", "Sabotino", "San Donato"]);
  const startDate = parseDate("2019-01-01");
  const markerDate = parseDate("2023-08-01");

  function aggregateSemiannual(rows) {
    // Map + filter
    const filtered = rows
      .map((d) => ({
        date: parseDate(d.data),
        value: +d.totale,
        station: d.colonnina,
      }))
      .filter(
        (d) =>
          d.date &&
          d.date >= startDate &&
          d.value > 0 &&
          selectedStations.has(d.station)
      );

    // Roll up by half-year (H1/H2)
    const rolled = d3
      .rollups(
        filtered,
        (v) => d3.mean(v, (d) => d.value),
        (d) => {
          const y = d.date.getFullYear();
          const half = Math.floor(d.date.getMonth() / 6) + 1; // 1 or 2
          return `${y}-H${half}`;
        }
      )
      .map(([key, mean]) => {
        const [y, h] = key.split("-H");
        return { date: new Date(+y, (h - 1) * 6, 1), mean };
      });

    return rolled.sort((a, b) => d3.ascending(a.date, b.date));
  }

  function render(rows) {
    const data = aggregateSemiannual(rows);
    if (!data.length) {
      g.append("text")
        .attr("class", "no-data")
        .attr("x", 0)
        .attr("y", 0)
        .text("Nessun dato");
      return;
    }

    // Scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.date))
      .range([0, w]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.mean)])
      .nice()
      .range([h, 0]);

    // Axes (ticks every 6 months, labeled only for full years)
    const tickEvery6m = d3.timeMonth.every(6);
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .attr("class", "axis")
      .call(
        d3
          .axisBottom(x)
          .ticks(tickEvery6m)
          .tickFormat(
            (d) =>
              d.getMonth() === 0
                ? `${d.getFullYear()}` // Only show year for H1 (January)
                : "" // Empty string for H2 (July)
          )
      );

    g.append("g").attr("class", "axis").call(d3.axisLeft(y));

    // Line
    const line = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.mean));

    g.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", line);

    // Points (optional)
    g.selectAll("circle.point")
      .data(data)
      .join("circle")
      .attr("class", "point")
      .attr("cx", (d) => x(d.date))
      .attr("cy", (d) => y(d.mean))
      .attr("r", 4);

    // Città 30 marker - colored area from 2024 to the right
    const mx = x(markerDate);

    // Create a rectangle covering the area from 2024 to the right edge
    g.append("rect")
      .attr("class", "zona30-area")
      .attr("x", mx)
      .attr("y", 0)
      .attr("width", w - mx) // From marker to right edge
      .attr("height", h)
      .attr("fill", "rgba(200, 200, 200, 0.3)") // Light gray with transparency
      .attr("stroke", "none")
      .lower(); // Put it behind the data lines

    // Add label at the left edge of the colored area
    g.append("text")
      .attr("class", "zona30-label")
      .attr("x", mx + 5)
      .attr("y", 15)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .attr("fill", "#f3f4f6;")
      .text("Città 30");
  }

  // Load data (cached)
  let alive = true;
  (async () => {
    try {
      if (!bikeDataCache) {
        bikeDataCache = await d3.csv("data/bike-trimmed.csv"); // ensure this is next to index.html
      }
      if (alive) render(bikeDataCache);
    } catch (err) {
      console.error("Errore:", err);
      g.append("text")
        .attr("class", "no-data")
        .attr("x", 0)
        .attr("y", 0)
        .text("Errore nel caricamento dei dati.");
    }
  })();

  return {
    dispose() {
      alive = false;
      host.selectAll("*").remove();
    },
  };
}
