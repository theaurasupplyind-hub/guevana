const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('windowBar', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:maximize-toggle'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizeChange: (cb) => {
    const listener = (_event, isMaximized) => cb(isMaximized)
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  }
})
