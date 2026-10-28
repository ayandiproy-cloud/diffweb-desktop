// The only bridge between the website and Windows: the app version, "Check for updates" and "Block screenshots".
// Nothing else from Windows is reachable from the page.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('diffwebDesktop', {
  version: () => ipcRenderer.invoke('dw:version'),
  checkForUpdates: () => ipcRenderer.invoke('dw:check'),
  installUpdate: () => ipcRenderer.invoke('dw:install'),
  blockShots: (on) => ipcRenderer.invoke('dw:shots', typeof on === 'boolean' ? on : undefined),
  onShots: (cb) => { ipcRenderer.on('dw:shots', (_e, v) => { try { cb(!!v); } catch (x) { } }); },
  onUpdate: (cb) => { ipcRenderer.on('dw:update', (_e, s) => { try { cb(s); } catch (x) { } }); },
});
