// DiffWeb for Windows. A small, locked-down window around https://diffweb.com.
// Everything you see is the website, so website updates reach the app automatically.
// Security: no Node.js in the page, sandboxed renderer, only diffweb.com opens inside the app,
// every other link opens in your normal browser.
'use strict';
const { app, BrowserWindow, Menu, Tray, Notification, shell, session, nativeImage, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const SITE = 'https://diffweb.com';
const START = SITE + '/app/home?source=app';
const ORIGIN = new URL(SITE).origin;
const ICON = path.join(__dirname, 'icon.png');

// Small settings file in the app's own folder. Screenshots are blocked unless the person turns it off.
const SETTINGS = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() { try { return Object.assign({ blockShots: true }, JSON.parse(fs.readFileSync(SETTINGS(), 'utf8'))); } catch (e) { return { blockShots: true }; } }
function saveSettings() { try { fs.writeFileSync(SETTINGS(), JSON.stringify(settings)); } catch (e) { /* ignore */ } }
let settings = { blockShots: true };

let win = null;
let tray = null;
let quitting = false;

// One copy only: opening DiffWeb again brings the open window to the front.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => show());
}

app.setAppUserModelId('com.diffweb.desktop'); // proper name and icon on Windows notifications

function isOurs(u) {
  try { return new URL(u).origin === ORIGIN; } catch (e) { return false; }
}

function openOutside(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'https:' || x.protocol === 'http:' || x.protocol === 'mailto:') shell.openExternal(x.toString());
  } catch (e) { /* ignore bad links */ }
}

function show() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: 'DiffWeb',
    icon: ICON,
    backgroundColor: '#FBF7F0',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // The website shows its app layout (side menu, no website header) when it sees this.
  win.webContents.setUserAgent(win.webContents.getUserAgent() + ' DiffWebDesktop/' + app.getVersion());

  // Windows leaves this window out of screenshots, screen recording and screen sharing (it shows black there).
  win.setContentProtection(!!settings.blockShots);

  // Open at once: a small DiffWeb screen shows straight away (it's inside the app, so no waiting),
  // and stays until diffweb.com is ready to paint. Before, the window only appeared after the site loaded.
  const hidden = process.argv.includes('--hidden');
  win.once('ready-to-show', () => { if (!hidden) win.show(); });
  win.loadFile(path.join(__dirname, 'splash.html')).then(() => win && !win.isDestroyed() && win.loadURL(START)).catch(() => win && win.loadURL(START));

  // Only diffweb.com opens inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) { win.loadURL(url); } else { openOutside(url); }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isOurs(url) && !/^file:/.test(url)) { e.preventDefault(); openOutside(url); }
  });

  // No internet: a friendly page with a Try again button.
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3 && /^https?:/.test(url || '')) win.loadFile(path.join(__dirname, 'offline.html'));
  });

  // Right-click: cut, copy, paste.
  win.webContents.on('context-menu', (e, p) => {
    const items = [];
    if (p.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' });
    else if (p.selectionText) items.push({ role: 'copy' });
    if (p.linkURL && !isOurs(p.linkURL)) items.push({ label: 'Open link in browser', click: () => openOutside(p.linkURL) });
    if (items.length) Menu.buildFromTemplate(items).popup();
  });

  // Closing the window keeps DiffWeb in the tray, so notifications still arrive.
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  win.on('closed', () => { win = null; });
}

/* ---------- updates: checks GitHub Releases, downloads in the background, installs on restart ---------- */
let upd = { state: 'idle', version: null, percent: 0, error: '' };
function sendUpd(patch) {
  upd = Object.assign({}, upd, patch);
  if (win && !win.isDestroyed()) win.webContents.send('dw:update', upd);
  if (tray) buildTrayMenu();
}
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => sendUpd({ state: 'checking', error: '' }));
autoUpdater.on('update-available', (i) => sendUpd({ state: 'downloading', version: i.version, percent: 0 }));
autoUpdater.on('update-not-available', () => sendUpd({ state: 'latest' }));
autoUpdater.on('download-progress', (p) => sendUpd({ state: 'downloading', percent: Math.round(p.percent || 0) }));
autoUpdater.on('update-downloaded', (i) => {
  sendUpd({ state: 'ready', version: i.version });
  if (Notification.isSupported()) {
    const n = new Notification({ title: 'DiffWeb update ready', body: 'Version ' + i.version + ' is ready. Restart DiffWeb to finish.', icon: ICON });
    n.on('click', () => { quitting = true; autoUpdater.quitAndInstall(); });
    n.show();
  }
});
autoUpdater.on('error', (e) => sendUpd({ state: 'error', error: String((e && e.message) || e).slice(0, 200) }));
function checkUpdates() {
  if (process.windowsStore) { sendUpd({ state: 'latest' }); return Promise.resolve(upd); } // the Store updates it
  if (!app.isPackaged) { sendUpd({ state: 'latest' }); return Promise.resolve(upd); }
  return autoUpdater.checkForUpdates().then(() => upd).catch((e) => { sendUpd({ state: 'error', error: String(e.message || e).slice(0, 200) }); return upd; });
}
ipcMain.handle('dw:version', () => ({ version: app.getVersion(), update: upd }));
function setBlockShots(on) {
  settings.blockShots = !!on; saveSettings();
  if (win) win.setContentProtection(settings.blockShots);
  if (tray) buildTrayMenu();
  if (win) win.webContents.send('dw:shots', settings.blockShots);
  return settings.blockShots;
}
ipcMain.handle('dw:shots', (e, on) => {
  if (!isOurs(e.senderFrame ? e.senderFrame.url : '')) return settings.blockShots;
  return typeof on === 'boolean' ? setBlockShots(on) : settings.blockShots;
});
ipcMain.handle('dw:check', (e) => (isOurs(e.senderFrame ? e.senderFrame.url : '') ? checkUpdates() : upd));
ipcMain.handle('dw:install', (e) => { if (upd.state === 'ready' && isOurs(e.senderFrame ? e.senderFrame.url : '')) { quitting = true; autoUpdater.quitAndInstall(); } return upd; });

function updLabel() {
  return upd.state === 'checking' ? 'Checking for updates…' : upd.state === 'downloading' ? 'Downloading update ' + (upd.percent || 0) + '%' :
    upd.state === 'ready' ? 'Restart to update to ' + upd.version : upd.state === 'latest' ? 'You have the latest version' : 'Check for updates';
}
function buildTrayMenu() {
  const login = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open DiffWeb', click: show },
    { type: 'separator' },
    { label: updLabel(), enabled: upd.state !== 'checking' && upd.state !== 'downloading', click: () => (upd.state === 'ready' ? (quitting = true, autoUpdater.quitAndInstall()) : checkUpdates()) },
    { label: 'DiffWeb version ' + app.getVersion(), enabled: false },
    { type: 'separator' },
    { label: 'Block screenshots', type: 'checkbox', checked: !!settings.blockShots, click: (i) => setBlockShots(i.checked) },
    { label: 'Start with Windows', type: 'checkbox', checked: login, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked, args: ['--hidden'] }) },
    { label: 'Reload', click: () => win && win.webContents.reloadIgnoringCache() },
    { type: 'separator' },
    { label: 'Quit DiffWeb', click: () => { quitting = true; app.quit(); } },
  ]));
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16, quality: 'best' }));
  tray.setToolTip('DiffWeb');
  buildTrayMenu();
  tray.on('click', show);
}

// Notifications: the website never puts message text in a notification, only counts
// ("3 new messages"). We ask it every minute while the window isn't in front.
let lastNote = '';
async function checkNew() {
  if (win && win.isVisible() && win.isFocused()) return;
  try {
    const res = await session.defaultSession.fetch(SITE + '/api/push/peek', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const d = await res.json();
    if (!d || !d.body || d.body === 'You have something new.' || d.body === lastNote) return;
    lastNote = d.body;
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: d.title || 'DiffWeb', body: d.body, icon: ICON, silent: false });
    n.on('click', () => { show(); if (d.url && isOurs(SITE + d.url)) win.loadURL(SITE + d.url); });
    n.show();
  } catch (e) { /* offline: try again next minute */ }
}

app.whenReady().then(() => {
  settings = loadSettings();
  Menu.setApplicationMenu(null);

  // Allow only what DiffWeb needs: notifications, microphone (voice notes), clipboard. Camera and location are refused.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    const ok = isOurs(details.requestingUrl || wc.getURL()) && ['notifications', 'media', 'clipboard-sanitized-write', 'clipboard-read'].includes(permission);
    if (permission === 'media' && details.mediaTypes && details.mediaTypes.includes('video')) return cb(false);
    cb(ok);
  });

  createWindow();
  buildTray();
  setInterval(checkNew, 60 * 1000);
  setTimeout(checkUpdates, 10 * 1000);             // shortly after opening
  setInterval(checkUpdates, 6 * 60 * 60 * 1000);   // and every 6 hours
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', (e) => { /* stay in the tray */ });
app.on('web-contents-created', (e, wc) => {
  wc.on('will-attach-webview', (ev) => ev.preventDefault()); // no embedded webviews, ever
});
process.on('uncaughtException', (err) => {
  try { dialog.showErrorBox('DiffWeb', 'Something went wrong: ' + err.message); } catch (e) { }
});
