// js/charts/evShare.js
// Electric Vehicles share chart (ported from script.js, modular & responsive)

export function chartEVShare(rootEl, d3) {
  // State
  let data = [];
  let currentMode = "total"; // 'total' | 'focused'
  let resizeObs;
  let disposed = false;

  // Read CSV URL from data-ev-url (default fallback)
  const url = rootEl.dataset.evUrl || "data/electric.csv";

  // Build structure
  rootEl.classList.add("ev-share");
  const wrap = d3
    .select(rootEl)
    .style("position", "relative")
    .style("display", "grid")
    .style("grid-template-rows", "1fr auto")
    .style("gap", "8px");

  const svg = wrap.append("svg").attr("role", "img");
  const g = svg.append("g");

  // Buttons
  const controls = wrap
    .append("div")
    .attr("class", "ev-buttons")
    .style("display", "flex")
    .style("gap", "8px");

  function setActive() {
    controls
      .selectAll("button")
      .classed("active", false)
      .style("cursor", "pointer")
      .style("padding", "4px 8px")
      .style("border", "1px solid #e5e7eb")
      .style("borderRadius", "6px")
      .style("background", "#fff")
      .style("fontFamily", "inherit");
  }

  // Load & init
  d3.csv(url)
    .then((rows) => {
      if (disposed) return;
      data = rows
        .map((d) => ({
          year: new Date(String(d.year)),
          percentage: +d.percentage,
        }))
        .sort((a, b) => a.year - b.year);

      setActive();
      setupResize();
      render();
    })
    .catch((err) => {
      console.error("[ev-share] Failed to load CSV:", err);
      wrap
        .append("div")
        .style("color", "#b91c1c")
        .text("Unable to load EV data.");
    });

  function sizeOf(el, minW = 200, minH = 120) {
    const r = el.getBoundingClientRect?.() || { width: minW, height: minH };
    return { width: Math.max(minW, r.width), height: Math.max(minH, r.height) };
  }

  function setupResize() {
    const roTarget = rootEl; // container with explicit height (e.g., 40vh)
    resizeObs = new ResizeObserver(() => render());
    resizeObs.observe(roTarget);
  }

  function render() {
    if (!data.length || disposed) return;

    // Margins & size
    const { width, height } = sizeOf(rootEl);
    const margin = { top: 18, right: 20, bottom: 28, left: 44 };
    const w = Math.max(240, width) - margin.left - margin.right;
    const h =
      Math.max(140, height) -
      margin.top -
      margin.bottom -
      controls.node().offsetHeight;

    svg
      .attr("width", w + margin.left + margin.right)
      .attr("height", h + margin.top + margin.bottom);

    g.attr("transform", `translate(${margin.left},${margin.top})`);
    g.selectAll("*").remove();

    // Scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.year))
      .range([0, w]);

    const y = d3
      .scaleLinear()
      .domain(
        currentMode === "total"
          ? [0, 100]
          : [0, d3.max(data, (d) => d.percentage) + 2]
      )
      .nice()
      .range([h, 0]);

    // Axes
    const xAxis = d3
      .axisBottom(x)
      .ticks(Math.min(6, data.length))
      .tickFormat(d3.timeFormat("%Y"));
    const yAxis = d3
      .axisLeft(y)
      .ticks(6)
      .tickFormat((d) => d + "%");

    g.append("g").attr("transform", `translate(0,${h})`).call(xAxis);
    g.append("g").call(yAxis);

    // Title
    g.append("text")
      .attr("x", w / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "700")
      .text(
        currentMode === "total"
          ? "Electric vs Non-Electric Cars"
          : "Electric Cars Growth (Focused)"
      );

    if (currentMode === "total") {
      // Areas (mirroring your original script.js logic)
      const areaElectric = d3
        .area()
        .x((d) => x(d.year))
        .y0(h)
        .y1((d) => y(d.percentage));

      const areaNonElectric = d3
        .area()
        .x((d) => x(d.year))
        .y0((d) => y(d.percentage))
        .y1(0);

      // Non-electric (light)
      g.append("path")
        .datum(data)
        .attr("fill", "#ffffff")
        .attr("stroke", "#222")
        .attr("stroke-width", 0.8)
        .attr("d", areaNonElectric)
        .attr("opacity", 1);

      // Electric (accent red like your colors.eu in script.js)
      g.append("path")
        .datum(data)
        .attr("fill", "#C81515")
        .attr("d", areaElectric);

      // Legend w/ connector line to curve at same x as legend square
      const legendX = w - 150,
        legendY = Math.max(24, h * 0.55);
      const legend = g
        .append("g")
        .attr("transform", `translate(${legendX},${legendY})`);

      // Non-electric
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", "#ffffff")
        .attr("stroke", "#222")
        .attr("stroke-width", 1);
      legend
        .append("text")
        .attr("x", 20)
        .attr("y", 12)
        .style("font-size", "12px")
        .text("Non-Electric Cars (%)");

      // Electric
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", 20)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", "#C81515")
        .attr("stroke", "#222")
        .attr("stroke-width", 1);
      const lab = legend
        .append("text")
        .attr("x", 20)
        .attr("y", 32)
        .style("font-size", "12px")
        .text("Electric Cars (%)");

      // Connector to the electric area at legend’s center x
      try {
        const rects = legend.selectAll("rect").nodes();
        const electricRect = rects[1];
        const rb = electricRect.getBBox();
        const legendCenterX = legendX + rb.x + rb.width / 2;

        const dateAtLegendX = x.invert(legendCenterX);
        // Find bracketing points for interpolation
        let lo = data[0],
          hi = data[data.length - 1];
        for (let i = 0; i < data.length - 1; i++) {
          if (
            data[i].year <= dateAtLegendX &&
            data[i + 1].year >= dateAtLegendX
          ) {
            lo = data[i];
            hi = data[i + 1];
            break;
          }
        }
        const t = (dateAtLegendX - lo.year) / (hi.year - lo.year || 1);
        const pct = lo.percentage + t * (hi.percentage - lo.percentage);
        const yAt = y(pct);

        const yStart = legendY + 32; // legend text baseline
        if (yStart <= yAt) {
          g.append("line")
            .attr("x1", legendCenterX)
            .attr("y1", yStart)
            .attr("x2", legendCenterX)
            .attr("y2", yAt)
            .attr("stroke", "#222")
            .attr("stroke-width", 1);
          if (typeof legend.raise === "function") legend.raise();
        }
      } catch (e) {
        /* best effort, ignore */
      }
    } else {
      // Focused (line + points)
      const line = d3
        .line()
        .x((d) => x(d.year))
        .y((d) => y(d.percentage));

      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#C81515")
        .attr("stroke-width", 3)
        .attr("d", line);

      g.selectAll(".pt")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "pt")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.percentage))
        .attr("r", 4)
        .attr("fill", "#C81515");

      // Simple legend
      const legend = g
        .append("g")
        .attr("transform", `translate(${w - 150}, 8)`);
      legend
        .append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", "#C81515");
      legend
        .append("text")
        .attr("x", 20)
        .attr("y", 12)
        .style("font-size", "12px")
        .text("Electric Cars (%)");
    }

    // Top/right border (as in your original)
    g.append("line")
      .attr("x1", 0)
      .attr("x2", w)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "#000")
      .attr("stroke-width", 1)
      .attr("shape-rendering", "crispEdges");
    g.append("line")
      .attr("x1", w)
      .attr("x2", w)
      .attr("y1", 0)
      .attr("y2", h)
      .attr("stroke", "#000")
      .attr("stroke-width", 1)
      .attr("shape-rendering", "crispEdges");
  }

  // Required dispose() API for the carousel mount/unmount lifecycle
  return {
    dispose() {
      disposed = true;
      try {
        resizeObs?.disconnect();
      } catch {}
      d3.select(rootEl).selectAll("*").remove();
    },
  };
}
