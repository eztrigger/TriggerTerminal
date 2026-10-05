const { contextBridge, ipcRenderer } = require('electron');
// Keep the existing web UI's narrow native bridge; expose no filesystem or shell API.
contextBridge.exposeInMainWorld('webkit', { messageHandlers: {
  restartTerminal: { postMessage: () => ipcRenderer.send('terminal:restart') },
  setLanguage: { postMessage: value => { if (value === 'en' || value === 'zh-CN') ipcRenderer.send('terminal:language', value); } },
} });
