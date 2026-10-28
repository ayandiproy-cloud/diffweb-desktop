// The only bridge between the website and Windows: the app version and "Check for updates".
// Nothing else from Windows is reachable from the page.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('diffwebDesktop', {
  version: () => ipcRenderer.invoke('dw:version'),
  checkForUpdates: () => ipcRenderer.invoke('dw:check'),
  installUpdate: () => ipcRenderer.invoke('dw:install'),
  onUpdate: (cb) => { ipcRenderer.on('dw:update', (_e, s) => { try { cb(s); } catch (x) { } }); },
});
