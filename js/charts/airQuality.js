// js/charts/airQuality.js (fixed: use selection from makeSVG directly)
import { sizeOf, makeSVG } from "./utils.js";

const COLORS = {
  "GIARDINI MARGHERITA": "#00916E",
  "PORTA SAN FELICE": "#F3B61F",
  eu: "#C81515",
  who: "#000831",
};

const gasInfo = {
  PM10: "<strong>PM10</strong> are tiny airborne particles from sources like dust and traffic that can be inhaled, irritating the lungs and worsening respiratory and heart conditions. The introduction of Città 30 had little impact on their presence.",
  "O3 (OZONO)":
    "<strong>O₃ (ozone)</strong> at ground level is a harmful air pollutant formed by chemical reactions in sunlight, which can irritate the lungs, worsen asthma, and reduce overall respiratory function. The introduction of Città 30 has stressed the already existing pattern of the <strong>reduction of this gas.</strong>",
  "CO (MONOSSIDO DI CARBONIO)":
    "<strong>CO (carbon monoxide)</strong> is a colorless, odorless gas from incomplete combustion that harms oxygen delivery in the body, and its levels have been <strong>decreasing</strong> every year.",
  "NO2 (BIOSSIDO DI AZOTO)":
    "<strong>NO₂ (nitrogen dioxide)</strong> is a gas mainly produced by traffic and combustion processes, which can irritate the airways, worsen asthma, and contribute to smog and acid rain. Its levels have been gradually decreasing, but the introduction of Città 30 does not seem to have had a great effect.",
  "PM2.5":
    "<strong>PM2.5</strong> are fine particulate matter with a diameter of 2.5 micrometers or smaller, which can penetrate deep into the lungs and bloodstream, causing respiratory and cardiovascular problems. Their levels have been slowly decreasing, but the introduction of Città 30 appears to have had little impact.",
  "C6H6 (BENZENE)":
    "<strong>C₆H₆ (benzene)</strong> is a volatile organic compound mainly emitted by traffic and industrial processes, which can harm the blood, cause dizziness, and long-term exposure increases the risk of cancer. Its levels have been stable over the years and well under the EU threshold.",
};

const THRESHOLDS = {
  "C6H6 (BENZENE)": { EU: 5 },
  "CO (MONOSSIDO DI CARBONIO)": { EU: 10 },
  "NO2 (BIOSSIDO DI AZOTO)": { WHO: 10, EU: 40 },
  "O3 (OZONO)": { EU: 25 }, // exceedance days
  "PM2.5": { WHO: 5, EU: 20 },
  PM10: { WHO: 15, EU: 40 },
};

const DEFAULT_POLLUTANTS = [
  "PM10",
  "O3 (OZONO)",
  "CO (MONOSSIDO DI CARBONIO)",
  "NO2 (BIOSSIDO DI AZOTO)",
  "PM2.5",
  "C6H6 (BENZENE)",
];

export function chartAirQuality(container, d3) {
  if (!d3) return { dispose() {} };

  const gasURL =
    container.dataset.gasUrl || container.dataset.gasurl || "gases.json";
  const stationsOpt = (
    container.dataset.stations || "GIARDINI MARGHERITA,PORTA SAN FELICE"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let pollutantsOpt = (container.dataset.pollutants || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!pollutantsOpt.length) pollutantsOpt = DEFAULT_POLLUTANTS;

  const root = d3.select(container);
  root.selectAll("*").remove();
  container.style.position = "relative";

  const { width, height } = sizeOf(container, 760, 380);
  const margin = { top: 28, right: 24, bottom: 42, left: 52 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  // Create legend above the graph
  const legend = root
    .append("div")
    .style("display", "grid")
    .style("grid-auto-flow", "column")
    .style("gap", "14px")
    .style("justify-content", "end")
    .style("margin-bottom", "8px");

  // FIX: makeSVG returns a selection, so append on it directly
  const svg = makeSVG(d3, container, width, height);
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const gx = g
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .attr("class", "axis");
  const gy = g.append("g").attr("class", "axis");
  const thresh = g.append("g").attr("class", "thresholds");
  const threshLbl = g.append("g").attr("class", "threshold-labels");
  const series = g.append("g").attr("class", "series");

  // Create buttons under the graph
  const ui = root
    .append("div")
    .attr("class", "aq-ui")
    .style("display", "grid")
    .style("gap", "8px");
  const btnRow = ui
    .append("div")
    .style("display", "flex")
    .style("gap", "8px")
    .style("justify-content", "center");

  let state = { pollutant: pollutantsOpt[0], gases: null };

  function drawLegend(stations) {
    legend.selectAll("*").remove();
    stations.forEach((s) => {
      const row = legend
        .append("div")
        .style("display", "grid")
        .style("grid-auto-flow", "column")
        .style("align-items", "center")
        .style("gap", "6px");
      row
        .append("span")
        .style("width", "18px")
        .style("height", "3px")
        .style("background", COLORS[s] || "#333");
      row.append("span").style("font-size", "12px").text(s);
    });
  }

  function drawThresholds(yScale, pollutant) {
    thresh.selectAll("*").remove();
    threshLbl.selectAll("*").remove();
    const t = THRESHOLDS[pollutant] || {};
    if (t.EU != null) {
      thresh
        .append("line")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", yScale(t.EU))
        .attr("y2", yScale(t.EU))
        .attr("stroke", COLORS.eu)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4 4");
      threshLbl
        .append("text")
        .attr("x", w - 4)
        .attr("y", yScale(t.EU) - 4)
        .style("font-size", "10px")
        .attr("text-anchor", "end")
        .attr("fill", COLORS.eu)
        .text("EU Threshold");
    }
    if (
      t.WHO != null &&
      pollutant !== "CO (MONOSSIDO DI CARBONIO)" &&
      pollutant !== "O3 (OZONO)"
    ) {
      thresh
        .append("line")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", yScale(t.WHO))
        .attr("y2", yScale(t.WHO))
        .attr("stroke", COLORS.who)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4 4");
      threshLbl
        .append("text")
        .attr("x", w - 4)
        .attr("y", yScale(t.WHO) - 4)
        .style("font-size", "10px")
        .attr("text-anchor", "end")
        .attr("fill", COLORS.who)
        .text("WHO Threshold");
    }
  }

  function draw2024Line(xScale, chartType = "time", pollutantType = null) {
    // Remove any existing 2024 elements
    g.selectAll(".zona30-line").remove();
    g.selectAll(".zona30-label").remove();
    g.selectAll(".zona30-area").remove();

    let x2023;
    if (chartType === "band") {
      // For band scale, use year number and position between 2023 and 2024
      const x2023Band = xScale(2023);
      const x2024Band = xScale(2024);
      if (x2023Band !== undefined && x2024Band !== undefined) {
        x2023 = x2023Band + xScale.bandwidth(); // End of 2023 bar
      } else if (x2023Band !== undefined) {
        x2023 = x2023Band + xScale.bandwidth();
      }
    } else {
      // For time scale, use Date object
      x2023 = xScale(new Date(2023, 2, 0));
    }

    if (x2023 !== undefined && x2023 >= 0 && x2023 <= w) {
      // Create a rectangle covering the area from 2024 to the right edge
      g.append("rect")
        .attr("class", "zona30-area")
        .attr("x", x2023)
        .attr("y", 0)
        .attr("width", w - x2023) // From marker to right edge
        .attr("height", h)
        .attr("fill", "rgba(200, 200, 200, 0.3)") // Light gray with transparency
        .attr("stroke", "none")
        .lower(); // Put it behind the data lines

      // Position label at top for ozone, bottom for others
      const labelY = pollutantType === "O3 (OZONO)" ? 20 : h - 10;

      // Add label at the left edge of the colored area
      const label = g
        .append("text")
        .attr("class", "zona30-label")
        .attr("x", x2023 + 4)
        .attr("y", labelY)
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .attr("fill", "#f3f4f6")
        .text("Città 30");

      // Keep label visible above other elements
      label.raise();
    }
  }

  function renderO3(dataEu) {
    const yrs = Array.from(new Set(dataEu.map((d) => d.year))).sort(
      (a, b) => a - b
    );
    const x0 = d3.scaleBand().domain(yrs).range([0, w]).padding(0.2);
    const x1 = d3
      .scaleBand()
      .domain(stationsOpt)
      .range([0, x0.bandwidth()])
      .padding(0.2);
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(30, d3.max(dataEu, (d) => +d.exceedance_days) || 0)])
      .nice()
      .range([h, 0]);

    gx.call(d3.axisBottom(x0).tickFormat(d3.format("d")));
    gy.call(d3.axisLeft(y));

    series.selectAll("*").remove();

    const groups = series
      .selectAll(".yr")
      .data(yrs)
      .join("g")
      .attr("class", "yr")
      .attr("transform", (d) => `translate(${x0(d)},0)`);

    groups
      .selectAll("rect")
      .data((yr) =>
        stationsOpt.map((st) => {
          const r = dataEu.find((d) => d.year === yr && d.station === st);
          return { year: yr, station: st, value: r ? +r.exceedance_days : 0 };
        })
      )
      .join("rect")
      .attr("x", (d) => x1(d.station))
      .attr("y", y(0))
      .attr("width", x1.bandwidth())
      .attr("height", 0)
      .attr("fill", (d) => COLORS[d.station] || "#555")
      .transition()
      .duration(700)
      .attr("y", (d) => y(d.value))
      .attr("height", (d) => y(0) - y(d.value));

    drawThresholds(y, "O3 (OZONO)");
    draw2024Line(x0, "band", "O3 (OZONO)");
    drawLegend(stationsOpt);
  }

  function renderCO(rows) {
    const data = rows.map((d) => ({
      station: d.station,
      year: new Date(d.year, 0, 1),
      value: +d.yearly_max_8h_mean,
    }));
    const [ymin, ymax] = [0, Math.max(12, d3.max(data, (d) => d.value) || 0)];

    const x = d3
      .scaleTime()
      .domain([new Date(2019, 0, 1), new Date(2025, 0, 1)])
      .range([0, w]);
    const y = d3.scaleLinear().domain([ymin, ymax]).nice().range([h, 0]);

    gx.call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y")));
    gy.call(d3.axisLeft(y));

    series.selectAll("*").remove();

    const byStation = d3.groups(data, (d) => d.station);
    const line = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.value));

    byStation.forEach(([station, vals]) => {
      vals.sort((a, b) => a.year - b.year);
      const path = series
        .append("path")
        .attr("fill", "none")
        .attr("stroke", COLORS[station] || "#333")
        .attr("stroke-width", 2)
        .attr("d", line(vals));
      const L = path.node().getTotalLength();
      path
        .attr("stroke-dasharray", `${L} ${L}`)
        .attr("stroke-dashoffset", L)
        .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

      series
        .selectAll(`.pt-${station.replace(/\s+/g, "-")}`)
        .data(vals)
        .join("circle")
        .attr("r", 0)
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.value))
        .attr("fill", COLORS[station] || "#333")
        .transition()
        .delay(200)
        .duration(300)
        .attr("r", 4);
    });

    drawThresholds(y, "CO (MONOSSIDO DI CARBONIO)");
    draw2024Line(x, "time");
    drawLegend(byStation.map(([k]) => k));
  }

  function renderStandard(rows, pollutant) {
    console.log(pollutant);
    const data = rows
      .map((d) => ({
        station: d.station,
        year: new Date(d.year, 0, 1),
        value: +d.yearly_mean,
      }))
      .filter((d) => stationsOpt.includes(d.station));
    const years = Array.from(
      new Set(data.map((d) => d.year.getFullYear()))
    ).sort((a, b) => a - b);
    const x = d3
      .scaleTime()
      .domain([
        new Date(Math.min(...years), 0, 1),
        new Date(Math.max(...years), 0, 1),
      ])
      .range([0, w]);

    const vmax = d3.max(data, (d) => d.value) || 0;
    const t = THRESHOLDS[pollutant] || {};
    const ymax = Math.max(vmax, t.EU || 0, t.WHO || 0) + 1;
    const y = d3.scaleLinear().domain([0, ymax]).nice().range([h, 0]);

    gx.call(
      d3
        .axisBottom(x)
        .tickValues(years.map((y) => new Date(y, 0, 1)))
        .tickFormat(d3.timeFormat("%Y"))
    );
    gy.call(d3.axisLeft(y));

    series.selectAll("*").remove();

    const byStation = d3.groups(data, (d) => d.station);
    const line = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.value));

    byStation.forEach(([station, vals]) => {
      vals.sort((a, b) => a.year - b.year);
      const path = series
        .append("path")
        .attr("fill", "none")
        .attr("stroke", COLORS[station] || "#333")
        .attr("stroke-width", 2)
        .attr("d", line(vals));
      const L = path.node().getTotalLength();
      path
        .attr("stroke-dasharray", `${L} ${L}`)
        .attr("stroke-dashoffset", L)
        .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

      series
        .selectAll(`.pt-${station.replace(/\s+/g, "-")}`)
        .data(vals)
        .join("circle")
        .attr("r", 0)
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.value))
        .attr("fill", COLORS[station] || "#333")
        .transition()
        .delay(200)
        .duration(300)
        .attr("r", 4);
    });

    drawThresholds(y, pollutant);
    draw2024Line(x, "time");
    drawLegend(byStation.map(([k]) => k));
  }

  function update(pollutant) {
    g.selectAll(".title").remove();
    g.append("text")
      .attr("class", "title")
      .attr("x", w / 2)
      .attr("y", -8)
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .style("font-weight", "bold")
      .text(
        pollutant === "O3 (OZONO)"
          ? "Annual Ozone Exceedance Days"
          : pollutant === "CO (MONOSSIDO DI CARBONIO)"
          ? "Yearly Highest 8-Hour CO Concentration"
          : `${pollutant} – Yearly Average`
      );

    const data = state.gases?.[pollutant];
    if (!data) {
      series.selectAll("*").remove();
      return;
    }

    if (pollutant === "O3 (OZONO)") renderO3(data.eu || []);
    else if (pollutant === "CO (MONOSSIDO DI CARBONIO)") renderCO(data || []);
    else renderStandard(data || [], pollutant);
  }

  btnRow
    .selectAll("button")
    .data(pollutantsOpt)
    .join("button")
    .attr("type", "button")
    .attr("class", "graph-button")
    .text((d) => d.split(" ")[0])
    .classed("active", (d, i) => i === 0) // Set first button as active initially
    .on("click", function (event, d) {
      btnRow.selectAll("button").classed("active", false);
      d3.select("#gas-info").html(gasInfo[d]);
      d3.select(event.currentTarget).classed("active", true);
      update(d);
    });

  let alive = true;
  (async () => {
    try {
      const gases = await d3.json(gasURL);
      if (!alive) return;
      state.gases = gases;
      update(state.pollutant);
    } catch (e) {
      console.error(e);
      root.append("div").text("Error loading gases data.");
    }
  })();

  return {
    dispose() {
      alive = false;
      root.selectAll("*").remove();
    },
  };
}
