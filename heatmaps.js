  document.addEventListener("DOMContentLoaded", () => {

  // Map button switching
  document.querySelectorAll('.map-selector button').forEach(button => {
    button.addEventListener('click', () => {
      const selected = button.getAttribute('data-map');
      document.querySelectorAll('.map-frame').forEach(frame => {
        frame.classList.remove('active');
      });
      document.getElementById(selected).classList.add('active');
    });
  });

  // Chart.js setup
    const ctx1 = document.getElementById('streetChart').getContext('2d');
  let streetChart = new Chart(ctx1, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Totale Giornaliero', data: [] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Funzione per normalizzare i nomi delle vie
  function normalizeName(s) {
    return s.toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
  }

  // Handle messages from iframe maps
  window.addEventListener('message', event => {
    const { street } = event.data;
    if (!street) return;

    const normalized = normalizeName(street);
    console.log("Ricevuto nome via normalizzato:", normalized);

    fetch('./data/flusso_per_html_veicoli_per_trimestri.csv')
      .then(res => res.text())
      .then(text => {
        const [headerLine, ...lines] = text.trim().split('\n');
        const headers = headerLine.split(',');
        const rows = lines.map(line => {
          const cols = line.split(',');
          const obj = {};
          headers.forEach((h, i) => obj[h.trim()] = cols[i].trim());
          return {
            stname: normalizeName(obj.stname),
            period: +obj.period,
            order: +obj.order,
            label: obj.label,
            tot_day: +obj.tot_day
          };
        });

        const sel = rows
          .filter(r => r.stname === normalized)
          .sort((a, b) => a.order - b.order);

        if (sel.length === 0) {
          console.warn(`Nessun dato trovato per la via: ${normalized}`);
          return;
        }

        const labels = sel.map(r => r.period === 1 ? r.label : '');
        const data = sel.map(r => r.tot_day);

        document.getElementById('text-content').innerHTML =
          `<h2>${street}</h2><p>Dati trimestrali da CSV</p>`;

        streetChart.data.labels = labels;
        streetChart.data.datasets[0].data = data;
        streetChart.update();
      })
      .catch(err => console.error('Errore nel fetch del CSV:', err));
  }, false);



  // PER SEZIONE 2 (30 VS NON 30)
  async function loadCSV(url) {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.trim().split("\n");
      
      // Rimuove l'header e prende la prima riga di dati
      lines.shift();
      const [cars30, bikes30, carsAbove30, bikesAbove30] = lines[0].split(",").map(Number);

      return [cars30, bikes30, carsAbove30, bikesAbove30];
    }

    async function drawChart() {
      const data = await loadCSV("./data/df_30vsnon30.csv");

      new Chart(document.getElementById('chart'), {
        type: 'bar',
        data: {
          labels: [
            'Cars (≤ 30 km/h)',
            'Bikes (≤ 30 km/h)',
            'Cars (> 30 km/h)',
            'Bikes (> 30 km/h)'
          ],
          datasets: [{
            label: 'Traffico medio',
            data: data,
            backgroundColor: [
              'rgba(54, 162, 235, 0.7)', // auto ≤ 30
              'rgba(255, 99, 132, 0.7)', // bici ≤ 30
              'rgba(54, 162, 235, 0.7)', // auto > 30
              'rgba(255, 99, 132, 0.7)'  // bici > 30
            ]
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    drawChart()});