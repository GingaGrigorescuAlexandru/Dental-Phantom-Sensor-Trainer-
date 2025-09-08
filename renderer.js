const { ipcRenderer } = require('electron');
const Plotly = require('plotly.js-dist-min');

let tempData = [];
let pressData = [];
const maxPoints = 201;

const TEMP_LIMIT = 27.0;
const PRESS_LIMIT = 1010.0;

// Alert state
let tempAlertActive = false;
let pressAlertActive = false;

// Init graphs
Plotly.newPlot('graphTemp', [
  {
    y: tempData,
    type: 'scatter',
    mode: 'lines',
    name: 'Temperatură',
    line: { color: 'red' }
  }
], { margin: { t: 20, b: 30 } });

Plotly.newPlot('graphPress', [
  {
    y: pressData,
    type: 'scatter',
    mode: 'lines',
    name: 'Presiune',
    line: { color: 'orange' }
  }
], { margin: { t: 20, b: 30 } });

// Function to toggle alerts
function toggleAlert(id, active, msg, color) {
  const box = document.getElementById(id);
  if (active) {
    box.innerText = msg;
    box.style.background = color;
    box.style.display = "block";
  } else {
    box.style.display = "none";
  }
}

// Helper: split over-threshold indexes into separate intervals
function getIntervals(overIndexes) {
  if (overIndexes.length === 0) return [];
  const intervals = [];
  let start = overIndexes[0];
  let prev = overIndexes[0];

  for (let i = 1; i < overIndexes.length; i++) {
    if (overIndexes[i] !== prev + 1) {
      // gap detected → new interval
      intervals.push([start, prev]);
      start = overIndexes[i];
    }
    prev = overIndexes[i];
  }
  intervals.push([start, prev]); // last interval
  return intervals;
}

// Add interval markers (rectangles) for over-limit data
function updateMarkers(graphId, data, limit, icon) {
  const overIndexes = data
    .map((v, i) => (v > limit ? i : -1))
    .filter(i => i !== -1);

  if (overIndexes.length > 0) {
    const intervals = getIntervals(overIndexes);

    const shapes = [];
    const annotations = [];

    intervals.forEach(([start, end]) => {
      const yMax = Math.max(...data.slice(start, end + 1));

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: start,
        x1: end,
        y0: 0,
        y1: 1,
        fillcolor: 'rgba(255,0,0,0.1)',
        line: { width: 0 }
      });

      annotations.push({
        x: end,
        y: yMax,
        xref: 'x',
        yref: 'y',
        text: icon,
        showarrow: true,
        arrowhead: 2,
        ax: 0,
        ay: -30,
        font: { size: 20, color: 'yellow' },
        bgcolor: 'rgba(0,0,0,0.6)'
      });
    });

    Plotly.relayout(graphId, { shapes, annotations });
  } else {
    Plotly.relayout(graphId, { shapes: [], annotations: [] });
  }
}

// Receive data from main process
ipcRenderer.on('serial-data', (event, line) => {
  const [temp, press] = line.split(",").map(parseFloat);
  if (!isNaN(temp) && !isNaN(press)) {
    tempData.push(temp);
    pressData.push(press);

    // Keep only last maxPoints
    if (tempData.length > maxPoints) {
      tempData.shift();
      pressData.shift();
    }

    // Update graphs
    Plotly.update('graphTemp', { y: [tempData] });
    Plotly.update('graphPress', { y: [pressData] });

    // Update current values
    document.getElementById("tempVal").innerText = temp.toFixed(2) + " °C";
    document.getElementById("pressVal").innerText = press.toFixed(2) + " hPa";

    // Alerts
    tempAlertActive = temp > TEMP_LIMIT;
    pressAlertActive = press > PRESS_LIMIT;

    toggleAlert("tempAlert", tempAlertActive, `⚠️ Temperatură mare: ${temp} °C`, "darkred");
    toggleAlert("pressAlert", pressAlertActive, `⚠️ Presiune mare: ${press} hPa`, "darkorange");

    // Interval markers
    updateMarkers("graphTemp", tempData, TEMP_LIMIT, "🔥");
    updateMarkers("graphPress", pressData, PRESS_LIMIT, "⚡");
  }
});
