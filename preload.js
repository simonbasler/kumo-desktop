// Schmale, sichere Brücke zwischen Fenster und Hauptprozess
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kumoApi', {
  onMouse: (cb) => ipcRenderer.on('kumo:mouse', (_e, px) => cb(px)),
  onIdle: (cb) => ipcRenderer.on('kumo:idle', (_e, s) => cb(s)),
  onCommand: (cb) => ipcRenderer.on('kumo:cmd', (_e, c) => cb(c)),
  onOnTop: (cb) => ipcRenderer.on('kumo:ontop', (_e, v) => cb(v)),
  notify: (title, body) => ipcRenderer.send('kumo:notify', { title, body }),
  setTrayTitle: (t) => ipcRenderer.send('kumo:tray-title', t),
  setPomoLabel: (t) => ipcRenderer.send('kumo:pomo-label', t),
  setOnTop: (v) => ipcRenderer.send('kumo:set-ontop', v),
  getOnTop: () => ipcRenderer.invoke('kumo:get-ontop'),
  hide: () => ipcRenderer.send('kumo:hide')
});
