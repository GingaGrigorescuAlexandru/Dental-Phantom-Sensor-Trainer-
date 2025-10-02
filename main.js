const { app, BrowserWindow } = require('electron');
const path = require('path');
const XLSX = require('xlsx');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  win.webContents.once('did-finish-load', () => {
    // ------------------- XLSX READ -------------------
    const filePath = path.join(__dirname, 'Date_NTC_actualizate.xlsx');
    const workbook = XLSX.readFile(filePath);

    // Take first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with headers
    const data = XLSX.utils.sheet_to_json(worksheet);

    let index = 0;

    // Send each row's temperature
    const interval = setInterval(() => {
      if(index >= data.length) {
        clearInterval(interval); // stop when done
        console.log("Finished sending all rows");
        return;
      }

      const row = data[index];
      const temp = parseFloat(row["Temperatura (°C)"]);
      if(!isNaN(temp)) {
        console.log("[PARSED TEMP]", temp);
        win.webContents.send('serial-data', `${temp.toFixed(2)}`);
      }
      index++;
    }, 700); // 700 ms delay

    console.log('Excel file successfully processed');
  });
});
