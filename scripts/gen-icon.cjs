const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const ROOT = path.resolve(__dirname, '..')
const SVG_PATH = path.join(ROOT, 'Kristo.svg')
const TARGETS = {
  'mobile/assets/icon.png': 1024,
  'public/kristo.png': 64
}

function squareCrop(img) {
  const size = img.getSize()
  const side = Math.min(size.width, size.height)
  const x = Math.floor((size.width - side) / 2)
  const y = Math.floor((size.height - side) / 2)
  return img.crop({ x, y, width: side, height: side })
}

function extractEmbeddedPng() {
  const svg = fs.readFileSync(SVG_PATH, 'utf8')
  const m = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)
  return m ? Buffer.from(m[1], 'base64') : null
}

async function rasterizeSvg() {
  const win = new BrowserWindow({
    width: 1200,
    height: 1174,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: { offscreen: true, paintWhenInitiallyHidden: true }
  })
  try {
    await win.loadURL(pathToFileURL(SVG_PATH).href)
    await new Promise((resolve) => setTimeout(resolve, 400))
    const image = await win.webContents.capturePage()
    if (image.isEmpty()) throw new Error('capturePage devolvio una imagen vacia')
    return image
  } finally {
    win.destroy()
  }
}

async function run() {
  let source
  try {
    source = await rasterizeSvg()
    console.log('OK rasterizado desde SVG')
  } catch (e) {
    const embedded = extractEmbeddedPng()
    if (!embedded) {
      throw new Error(`No se pudo rasterizar el SVG (${e.message}) ni extraer el PNG incrustado`)
    }
    source = nativeImage.createFromBuffer(embedded)
    console.log('OK PNG incrustado extraido del SVG')
  }

  const square = squareCrop(source)
  for (const [rel, size] of Object.entries(TARGETS)) {
    const out = path.join(ROOT, rel)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    const resized = square.resize({ width: size, height: size })
    fs.writeFileSync(out, resized.toPNG())
    console.log('generado', rel)
  }
}

app.whenReady().then(async () => {
  try {
    await run()
    process.exitCode = 0
  } catch (e) {
    console.error('GEN_ICON_ERR', e.message)
    process.exitCode = 1
  }
  app.quit()
})
