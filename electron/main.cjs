const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { startServer } = require('./api/server.js')

const isDev = process.env.VITE_DEV === '1'
const DEV_URL = 'http://127.0.0.1:5177'

let win = null

const iconPath = path.join(__dirname, '../build/icon.ico')

function registerWindowIpc() {
  ipcMain.on('window:minimize', () => win && win.minimize())
  ipcMain.on('window:maximize-toggle', () => {
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', () => win && win.close())
}

async function boot() {
  try {
    const { port } = await startServer()
    registerWindowIpc()

    win = new BrowserWindow({
      width: 1440,
      height: 900,
      frame: false,
      backgroundColor: '#141414',
      title: 'DHUB',
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.cjs')
      }
    })

    win.on('maximize', () => win.webContents.send('window:maximized', true))
    win.on('unmaximize', () => win.webContents.send('window:maximized', false))

    await win.loadURL(isDev ? DEV_URL : `http://127.0.0.1:${port}`)
  } catch (e) {
    console.error('Error al iniciar DHUB:', e.message)
    app.exit(1)
  }
}

app.whenReady().then(boot)

app.on('window-all-closed', () => {
  app.quit()
})
