const { app, BrowserWindow } = require('electron');
// const SerialPort = require('serialport'); // pentru când ai acces la senzor
// const Readline = require('@serialport/parser-readline');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // ------------------- SIMULARE DATE -------------------
  let currentTemp = 25.0;   // baseline temperature
  let currentPress = 1005;  // baseline pressure
  let toolOn = false;       // whether tool is active
  let mistake = false;      // whether doctor "messes up"

  setInterval(() => {
    // Randomly decide if tool is on/off
    if (Math.random() < 0.05) { // 5% chance to toggle tool state
      toolOn = !toolOn;
      mistake = toolOn && Math.random() < 0.3; // 30% chance of mistake when tool goes on
    }

    if (toolOn) {
      if (mistake) {
        // ❌ doctor messes up → fast spike
        currentTemp += Math.random() * 1.5;   // sharp rise
        currentPress += Math.random() * 3;    // strong push
      } else {
        // ✅ normal work → small increase around baseline
        currentTemp += (Math.random() - 0.5) * 0.2;
        currentPress += (Math.random() - 0.5) * 0.5;
      }
    } else {
      // Tool off → gradual recovery back to baseline
      currentTemp += (25 - currentTemp) * 0.05;   // smooth decay
      currentPress += (1005 - currentPress) * 0.05;
    }

    // Clamp values to realistic ranges
    currentTemp = Math.max(20, Math.min(60, currentTemp));
    currentPress = Math.max(980, Math.min(1100, currentPress));

    // Send simulated values
    if (win) {
      win.webContents.send(
        'serial-data',
        `${currentTemp.toFixed(2)},${currentPress.toFixed(2)}`
      );
    }
  }, 200); // update every 200ms

  // ------------------- LOGICĂ SERIAL REALĂ -------------------
  /*
  const port = new SerialPort('/dev/ttyUSB0', { baudRate: 115200 });
  const parser = port.pipe(new Readline({ delimiter: '\n' }));

  parser.on('data', line => {
    if (win) win.webContents.send('serial-data', line);
  });
  */
});
