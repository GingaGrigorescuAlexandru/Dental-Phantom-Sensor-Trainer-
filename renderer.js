const Plotly = require('plotly.js-dist-min');
const { ipcRenderer } = require('electron');

let tempData = [];
let timeData = [];      // X-axis time
let t = 0;              // time counter in seconds
const timeStep = 0.7;   // average interval between values
const maxTime = 100;    // fixed X-axis window length

const TEMP_LIMIT = 32;           
const PULP_TEMP_LIMIT = 35;       
const RAPID_WINDOW = 5;           
const RAPID_TEMP_THRESHOLD = 1;  

let tempAlertActive = false;

// ------------------- Initialize Temperature Graph -------------------
Plotly.newPlot('graphTemp', [{
  x: [],
  y: [],
  type: 'scatter',
  mode: 'lines',
  name: 'Temperatură',
  line: { color: 'red' }
}], { 
  margin: { t: 20, b: 30 },
  xaxis: { title: 'Time (s)', range: [0, maxTime], autorange: false },
  yaxis: { title: 'Temperature (°C)', range: [25, 40], autorange: false }
}, { responsive: true });

// ------------------- Tool Status -------------------
function toggleToolStatus(active, msg) {
  let box = document.getElementById("toolStatusAlert");
  if (!box) {
    box = document.createElement("div");
    box.id = "toolStatusAlert";
    box.className = "alert toolStatus";
    document.querySelector(".temp-card").appendChild(box);
  }
  box.style.display = active ? "block" : "none";
  if (active) {
    box.innerText = msg;
    box.style.top = "5%";
    box.style.left = "50%";
    box.style.transform = "translate(-50%, 20%)";
    box.style.right = "";
  }
}

// ------------------- Helper functions -------------------
function getIntervals(overIndexes) {
  if (overIndexes.length === 0) return [];
  const intervals = [];
  let start = overIndexes[0], prev = overIndexes[0];

  for (let i = 1; i < overIndexes.length; i++) {
    if (overIndexes[i] !== prev + 1) {
      intervals.push([start, prev]);
      start = overIndexes[i];
    }
    prev = overIndexes[i];
  }
  intervals.push([start, prev]);
  return intervals;
}

function updateMarkers(graphId, data, limit) {
  const overIndexes = data.map((v, i) => v > limit ? i : -1).filter(i => i !== -1);
  if (!overIndexes.length) return Plotly.relayout(graphId, { shapes: [], annotations: [] });

  const intervals = getIntervals(overIndexes);
  const shapes = [];

  intervals.forEach(([start, end]) => {
    // Map indices to actual time values
    const x0 = timeData[start];
    const x1 = timeData[end];

    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: x0,
      x1: x1,
      y0: 0,
      y1: 1,
      fillcolor: 'rgba(255,0,0,0.1)',
      line: { width: 0 }
    });
  });

  Plotly.relayout(graphId, { shapes });
}

// ------------------- Receive Serial Data -------------------
ipcRenderer.on('serial-data', (event, line) => {
  const [temp] = line.split(",").map(parseFloat);
  if (isNaN(temp)) return;

  t += timeStep;
  timeData.push(t);
  tempData.push(temp);

  // Keep X-axis window fixed
  while (timeData.length && timeData[0] < t - maxTime) {
    timeData.shift();
    tempData.shift();
  }

  // Update temperature graph
  Plotly.update('graphTemp', { x: [timeData], y: [tempData] });

  const tempValEl = document.getElementById("tempVal");

  // Temperature alert (icon + red text)
  tempAlertActive = temp > TEMP_LIMIT;
  if (tempAlertActive) {
    tempValEl.innerHTML = `<span style="color:red;">${temp.toFixed(2)} °C ⚠️</span>`;
  } else {
    tempValEl.innerHTML = `${temp.toFixed(2)} °C`;
    tempValEl.style.color = "";
  }

  // Pulp chamber alert (logic only, no visible alert box now)
  const windowStart = Math.max(0, tempData.length - RAPID_WINDOW);
  const tempDiff = tempData[tempData.length - 1] - tempData[windowStart];
  const pulpAlertActive = temp >= PULP_TEMP_LIMIT && tempDiff >= RAPID_TEMP_THRESHOLD;

  // Tool status alert
  if (tempDiff > 0) toggleToolStatus(true, "🟢 Tool ON: temperatura crește");
  else if (tempDiff < 0) toggleToolStatus(true, "🔴 Tool OFF: temperatura scade");
  else toggleToolStatus(false);

  // Update temperature markers
  updateMarkers("graphTemp", tempData, TEMP_LIMIT);
});
