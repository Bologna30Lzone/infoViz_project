// js/charts/thirtyVsNon30.js
// Renders a simple 4‑bar Chart.js chart for 30‑vs‑non30 data in Q3.
// Usage in HTML: <div class="chart" data-type="30-vs-non30" data-csv-url="data/df_30vsnon30.csv"></div>
// CSV format (first row after header is used):
// cars30,bikes30,carsAbove30,bikesAbove30
// 123,456,78,90

export function chartThirtyVsNon30(container /* d3 not required */) {
  // Early bail if Chart.js is missing
  if (typeof Chart === "undefined") {
    container.textContent = "Chart.js not loaded";
    return { dispose() {} };
  }

  const csvUrl = container.dataset.csvUrl || "data/df_30vsnon30.csv";

  // Create a canvas we can clean up later
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  let chart; // will hold the Chart.js instance
  let aborted = false;

  async function loadCSV(url) {
    const res = await fetch(url);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) throw new Error("Empty CSV");
    // Remove header (assumes first line header)
    const header = lines.shift();
    // Parse first data row (fallback to zeros if missing)
    const row = (lines[0] || "").split(",").map(v => Number(v.trim()));
    const [cars30=0, bikes30=0, carsAbove30=0, bikesAbove30=0] = row;
    return [cars30, bikes30, carsAbove30, bikesAbove30];
  }

  async function draw() {
    try {
      const data = await loadCSV(csvUrl);
      if (aborted) return;

      const ctx = canvas.getContext("2d");
      chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: [
            "Cars (≤ 30 km/h)",
            "Bikes (≤ 30 km/h)",
            "Cars (> 30 km/h)",
            "Bikes (> 30 km/h)"
          ],
          datasets: [{
            label: "Traffico medio",
            data,
            backgroundColor: [
              "rgba(54, 162, 235, 0.7)",
              "rgba(255, 99, 132, 0.7)",
              "rgba(54, 162, 235, 0.7)",
              "rgba(255, 99, 132, 0.7)"
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { mode: "index", intersect: false }
          },
          scales: {
            x: { ticks: { autoSkip: false } },
            y: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          }
        }
      });
    } catch (err) {
      console.error("[30-vs-non30] Failed to draw:", err);
      container.textContent = "Unable to load 30 vs non‑30 data.";
    }
  }

  draw();

  return {
    dispose() {
      aborted = true;
      try { chart?.destroy(); } catch {}
      canvas.remove();
    }
  };
}
