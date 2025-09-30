const Plotly = require('plotly.js-dist-min');
const { ipcRenderer } = require('electron');

let tempData = [];
let pressData = [];
const maxPoints = 201;

const TEMP_LIMIT = 32;           
const PRESS_LIMIT = 1050;

const PULP_TEMP_LIMIT = 35;       
const RAPID_WINDOW = 5;           
const RAPID_TEMP_THRESHOLD = 1;  

let tempAlertActive = false;
let pressAlertActive = false;
let pulpAlertActive = false;

// Init graphs
Plotly.newPlot('graphTemp', [
  { y: tempData, type: 'scatter', mode: 'lines', name: 'Temperatură', line: { color: 'red' } }
], { margin: { t: 20, b: 30 } }, { responsive: true });

Plotly.newPlot('graphPress', [
  { y: pressData, type: 'scatter', mode: 'lines', name: 'Presiune', line: { color: 'orange' } }
], { margin: { t: 20, b: 30 } }, { responsive: true });

// Standard alert
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

// Pulp alert (top-left, slightly shifted)
function togglePulpAlert(active, msg) {
  const box = document.getElementById("pulpAlert");
  if (active) {
    box.innerHTML = `<img src="toothache.png" alt="alert"> ${msg}`;
    box.style.display = "block";
    box.style.top = "25px";    // slightly lower
    box.style.left = "115px";   // slightly more to the right
    box.style.width = "420px";
  } else {
    box.style.display = "none";
  }
}

// Tool On/Off alert (centered, slightly lower)
function toggleToolStatus(active, msg) {
  let box = document.getElementById("toolStatusAlert");
  if (!box) {
    box = document.createElement("div");
    box.id = "toolStatusAlert";
    box.className = "alert toolStatus";
    document.querySelector(".temp-card").appendChild(box);
  }
  if (active) {
    box.innerText = msg;
    box.style.display = "block";

    // Center horizontally, slightly lower
    box.style.top = "25px";               // halfway down the temp-card
    box.style.left = "50%";              // center horizontally
    box.style.transform = "translate(-50%, 20%)"; // offset slightly lower
    box.style.right = "";                 // reset right in case it was set
  } else {
    box.style.display = "none";
  }
}

// Helper functions
function checkRapidRise(data, window, threshold) {
  if (data.length < window) return false;
  return data[data.length - 1] - data[data.length - window] >= threshold;
}

function getIntervals(overIndexes) {
  if (overIndexes.length === 0) return [];
  const intervals = [];
  let start = overIndexes[0];
  let prev = overIndexes[0];

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

function updateMarkers(graphId, data, limit, icon) {
  const overIndexes = data.map((v, i) => (v > limit ? i : -1)).filter(i => i !== -1);
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

// Receive serial data
ipcRenderer.on('serial-data', (event, line) => {
  const [temp, press] = line.split(",").map(parseFloat);
  if (isNaN(temp) || isNaN(press)) return;

  tempData.push(temp);
  pressData.push(press);

  if (tempData.length > maxPoints) {
    tempData.shift();
    pressData.shift();
  }

  Plotly.update('graphTemp', { y: [tempData] });
  Plotly.update('graphPress', { y: [pressData] });

  document.getElementById("tempVal").innerText = temp.toFixed(2) + " °C";
  document.getElementById("pressVal").innerText = press.toFixed(2) + " hPa";

  // Regular alerts
  pressAlertActive = press > PRESS_LIMIT;
  toggleAlert("pressAlert", pressAlertActive, `⚠️ Presiune mare: ${press.toFixed(2)} hPa`, "darkorange");

  updateMarkers("graphTemp", tempData, TEMP_LIMIT, "🔥");
  updateMarkers("graphPress", pressData, PRESS_LIMIT, "⚡");

  // Pulp Chamber alert
  const windowStart = Math.max(0, tempData.length - RAPID_WINDOW);
  const tempDiff = tempData[tempData.length - 1] - tempData[windowStart];
  pulpAlertActive = temp >= PULP_TEMP_LIMIT && tempDiff >= RAPID_TEMP_THRESHOLD;

  togglePulpAlert(pulpAlertActive, pulpAlertActive ? 
    "ALERTA - Posibila penetrare a Camerei Pulpare! Temperatura ridicata creste rapid!" : ""
  );

  // Show regular temperature alert independently
  tempAlertActive = temp > TEMP_LIMIT;
  toggleAlert("tempAlert", tempAlertActive, `⚠️ Temperatură mare: ${temp.toFixed(2)} °C`, "darkred");

  // Tool on/off status
  if (tempDiff > 0) {
    toggleToolStatus(true, "🟢 Tool ON: temperatura crește");
  } else if (tempDiff < 0) {
    toggleToolStatus(true, "🔴 Tool OFF: temperatura scade");
  } else {
    toggleToolStatus(false);
  }
});

