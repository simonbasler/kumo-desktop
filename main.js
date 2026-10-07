// Kumo – Desktop-Begleiter: Hauptprozess
// Fragt die Mausposition systemweit ab, misst Leerlaufzeit, zeigt Mitteilungen und ein Menüleisten-Symbol.
const { app, BrowserWindow, screen, ipcMain, Notification, Tray, Menu, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');

// `npm start` (nicht gepackt) bekommt einen eigenen Datenordner, damit der Fortschritt der installierten App unberührt bleibt.
// Muss vor requestSingleInstanceLock() und dem ersten getPath('userData') passieren.
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'Kumo-dev'));

let win = null;
let tray = null;
let alwaysOnTop = true;
let pomoLabel = 'Pomodoro starten';

// Verhindere App-Beendigung außer wenn explizit gewollt
app.isQuitting = false;

const boundsFile = () => path.join(app.getPath('userData'), 'window.json');

// Sendet nur, wenn Fenster und Seite bereit sind. Beim Start oder während eines Reloads gibt es keinen Render-Frame,
// dann wird der Tick einfach übersprungen (Electron würde sonst "Render frame was disposed" loggen).
function sendToWindow(channel, ...args) {
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  if (wc.isDestroyed() || wc.isLoading()) return;
  try { wc.send(channel, ...args); } catch (e) {}
}

function loadBounds() {
  try { return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')); } catch (e) { return null; }
}
function saveBounds() {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(boundsFile(), JSON.stringify({ ...win.getBounds(), alwaysOnTop })); } catch (e) {}
}

function createWindow() {
  const saved = loadBounds();
  const W = 320, H = 480;
  const wa = screen.getPrimaryDisplay().workArea;
  let x = wa.x + wa.width - W - 24, y = wa.y + wa.height - H - 24;
  if (saved && screen.getAllDisplays().some(d => {
    const b = d.workArea; return saved.x >= b.x - 50 && saved.y >= b.y - 50 && saved.x < b.x + b.width && saved.y < b.y + b.height;
  })) { x = saved.x; y = saved.y; }
  if (saved && typeof saved.alwaysOnTop === 'boolean') alwaysOnTop = saved.alwaysOnTop;

  win = new BrowserWindow({
    width: W, height: H, x, y,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop, title: 'Kumo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false
    }
  });
  if (alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('moved', saveBounds);

  // KRITISCH: Verhindere dass Fenster geschlossen wird (nur verstecken!)
  win.on('close', (e) => {
    console.log('[kumo] close event, isQuitting:', app.isQuitting);
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
      console.log('[kumo] Window hidden instead of closed');
      return false;
    }
  });
}

/* ---------- Maus-Tracking ---------- */
function startTracking() {
  let last = null, acc = 0;
  setInterval(() => {
    const p = screen.getCursorScreenPoint();
    if (last) {
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 800) acc += d; // Sprünge (Bildschirmwechsel, Teleport) ignorieren
    }
    last = p;
  }, 40);
  setInterval(() => {
    if (process.env.KUMO_DEBUG) console.log('[kumo] px', Math.round(acc), JSON.stringify(screen.getCursorScreenPoint()));
    sendToWindow('kumo:mouse', Math.round(acc));
    acc = 0;
  }, 500);
  setInterval(() => {
    sendToWindow('kumo:idle', powerMonitor.getSystemIdleTime());
  }, 1000);
}

/* ---------- Menüleiste ---------- */
function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) win.hide(); else { win.show(); win.focus(); }
}
function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'Kumo zeigen / verstecken', click: toggleWindow },
    { type: 'separator' },
    { label: pomoLabel, click: () => sendToWindow('kumo:cmd', 'pomo-toggle') },
    { label: 'Pomodoro zurücksetzen', click: () => sendToWindow('kumo:cmd', 'pomo-reset') },
    { type: 'separator' },
    { label: 'Immer im Vordergrund', type: 'checkbox', checked: alwaysOnTop, click: (i) => setOnTop(i.checked) },
    { label: 'Einstellungen …', click: () => { if (win) { win.show(); sendToWindow('kumo:cmd', 'settings'); } } },
    { type: 'separator' },
    { label: 'Kumo beenden', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
}
function refreshMenu() { if (tray) tray.setContextMenu(buildMenu()); }
function setOnTop(v) {
  alwaysOnTop = !!v;
  if (win) win.setAlwaysOnTop(alwaysOnTop, 'floating');
  saveBounds(); refreshMenu();
  sendToWindow('kumo:ontop', alwaysOnTop);
}
function createTray() {
  const imgPath = path.join(__dirname, 'assets', 'trayTemplate.png');
  console.log('[kumo] Creating tray icon from:', imgPath);
  const img = nativeImage.createFromPath(imgPath);
  if (img.isEmpty()) {
    console.error('[kumo] Failed to load tray icon!');
    return;
  }
  img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip('Kumo');
  refreshMenu();
  console.log('[kumo] Tray created successfully');

  // Verhindere dass Tray destroyed wird
  tray.on('click', toggleWindow);
}

/* ---------- IPC ---------- */
ipcMain.on('kumo:notify', (_e, { title, body }) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show();
});
ipcMain.on('kumo:tray-title', (_e, t) => { if (tray && process.platform === 'darwin') tray.setTitle(t || ''); });
ipcMain.on('kumo:pomo-label', (_e, t) => { pomoLabel = t; refreshMenu(); });
ipcMain.on('kumo:set-ontop', (_e, v) => setOnTop(v));
ipcMain.on('kumo:hide', () => {
  if (!win) return;
  console.log('[kumo] Hide requested');
  win.hide();
  console.log('[kumo] Window hidden, isDestroyed:', win.isDestroyed());
});
ipcMain.handle('kumo:get-ontop', () => alwaysOnTop);

/* ---------- Start ---------- */
// Dev-Modus ohne Sperre, damit `npm start` neben der installierten App laufen kann.
if (app.isPackaged && !app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

  app.whenReady().then(() => {
    app.setName('Kumo');

    // macOS: Verhindere Auto-Quit
    if (process.platform === 'darwin') {
      app.dock.show(); // Zeige Dock-Icon explizit
    }

    createWindow();
    createTray();
    startTracking();
    app.on('activate', () => { if (win) win.show(); });
  });
  app.on('before-quit', (e) => {
    console.log('[kumo] before-quit, isQuitting:', app.isQuitting);
    if (!app.isQuitting) {
      console.log('[kumo] Preventing quit via before-quit');
      e.preventDefault();
      return;
    }
    saveBounds();
  });

  app.on('window-all-closed', () => {
    console.log('[kumo] window-all-closed event, isQuitting:', app.isQuitting);
    // NICHT beenden - App läuft über Tray/Dock weiter
    if (!app.isQuitting) {
      console.log('[kumo] Ignoring window-all-closed - app stays running');
    } else {
      console.log('[kumo] All windows closed and isQuitting=true, allowing quit');
    }
  });

  app.on('will-quit', (e) => {
    if (!app.isQuitting) {
      console.log('[kumo] Preventing quit - tray app should stay running');
      e.preventDefault();
    }
  });
}
