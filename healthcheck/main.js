const { app, Tray, Menu, nativeImage } = require('electron');
const https = require('https');
const http = require('http');

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const HEALTH_URL = process.env.HEALTH_URL || 'https://scheduler-myxy.onrender.com/api/health';

let tray = null;
let timer = null;
let lastStatus = 'unknown';

function pingHealth() {
  return new Promise((resolve) => {
    try {
      const isHttps = HEALTH_URL.startsWith('https://');
      const client = isHttps ? https : http;
      const req = client.get(HEALTH_URL, (res) => {
        // We don't need the body; just consume it.
        res.on('data', () => {});
        res.on('end', () => {
          resolve(res.statusCode >= 200 && res.statusCode < 300 ? 'ok' : `http_${res.statusCode}`);
        });
      });
      req.on('error', () => resolve('error'));
      req.setTimeout(15000, () => {
        req.destroy();
        resolve('timeout');
      });
    } catch {
      resolve('error');
    }
  });
}

function updateTrayLabel() {
  if (!tray) return;
  const title = lastStatus === 'ok' ? 'Health: OK' : `Health: ${lastStatus}`;
  tray.setToolTip(`${title}\n${HEALTH_URL}`);
}

async function runOnce() {
  lastStatus = await pingHealth();
  updateTrayLabel();
}

function createTray() {
  // Simple empty icon fallback (transparent)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    { label: 'Run Health Check Now', click: runOnce },
    { type: 'separator' },
    { label: `URL: ${HEALTH_URL}`, enabled: false },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  updateTrayLabel();
}

app.whenReady().then(async () => {
  createTray();
  await runOnce();
  timer = setInterval(runOnce, CHECK_INTERVAL_MS);
});

app.on('window-all-closed', (e) => {
  // Keep app running in tray
  e.preventDefault();
});

app.on('before-quit', () => {
  if (timer) clearInterval(timer);
});
