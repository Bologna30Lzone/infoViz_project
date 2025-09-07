// js/charts/thirtyVsNon30.js
// Renders a simple 4‑bar Chart.js chart for 30‑vs‑non30 data in Q3.
// Usage in HTML: <div class="chart" data-type="30-vs-non30" data-csv-url="data/df_30vsnon30.csv"></div>
// CSV format (first row after header is used):
// cars30,bikes30,carsAbove30,bikesAbove30
// 123,456,78,90

export function chartThirtyVsNon30(container) {
  if (typeof Chart === "undefined") {
    container.textContent = "Chart.js not loaded";
    return { dispose() {} };
  }

  const csvUrl = container.dataset.csvUrl || "data/df_30vsnon30.csv";

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  let chart;
  let aborted = false;

  async function loadCSV(url) {
    const res = await fetch(url);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) throw new Error("Empty CSV");
    lines.shift(); // rimuove header
    const row = (lines[0] || "").split(",").map((v) => Number(v.trim()));
    const [cars30 = 0, bikes30 = 0, carsAbove30 = 0, bikesAbove30 = 0] = row;

    return {
      cars: [cars30, carsAbove30],
      bikes: [bikes30, bikesAbove30],
    };
  }

  async function draw() {
    try {
      const data = await loadCSV(csvUrl);
      if (aborted) return;

      const ctx = canvas.getContext("2d");
      chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["30-only zone", "50-or-above zone"],
          datasets: [
            {
              label: "Cars",
              data: data.cars,
              backgroundColor: "rgba(0, 145, 110, 0.7)",
              borderWidth: 0,
            },
            {
              label: "Bikes",
              data: data.bikes,
              backgroundColor: "rgba(243, 182, 31, 0.7)",
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "none" }, // Disable all interactions
          plugins: {
            legend: { display: true, position: "top" },
            tooltip: { enabled: false }, // Disable tooltips
          },
          scales: {
            x: {
              ticks: {
                autoSkip: false,
                color: "#000831", // axis tick color
              },
              border: {
                color: "#000831", // axis line color
              },
              grid: { display: false }, // rimuove griglia sull'asse X
            },
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
                color: "#000831", // axis tick color
              },
              border: {
                color: "#000831", // axis line color
              },
              grid: { display: false }, // rimuove griglia sull'asse Y
            },
          },
        },
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
      try {
        chart?.destroy();
      } catch {}
      canvas.remove();
    },
  };
}
