const { app, BrowserWindow, ipcMain, screen, session } = require('electron')

const context = {
  mainWindow: null,
  leftWindow: null,
  rightWindow: null
}

function getTargetDisplay(filter) {
  return [...screen.getAllDisplays()].filter(filter)
}

const getLeftDisplay = () => {
  const primaryDisplay = screen.getPrimaryDisplay()

  return getTargetDisplay((display) => display.bounds.x < primaryDisplay.bounds.x)?.[0]
}

const getRightDisplay = () => {
  const primaryDisplay = screen.getPrimaryDisplay()

  return getTargetDisplay((display) => display.bounds.x > primaryDisplay.bounds.x)?.[0]
}

const createWindow = (url, options) => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      contextIsolation: false,
      sandbox: false,
      webviewTag: true
    },
    ...options
  })

  win.loadURL(url)

  return win
}

function injectHook(win) {
  const code = `
    console.log('[Hook] Electron hook initialed!')
    const { ipcRenderer } = require('electron')

    document.querySelectorAll('.maps-foot-r button').forEach((el, index) => {
      const pos = index !== 1 ? 'left-window' : 'right-window'

      const u = el.dataset?.u

      if ( !u ) return

      el.addEventListener('click', e => {
        e.preventDefault();

        ipcRenderer.send(pos, u)
        console.log('Click', pos, u)
      })

    })
  `

  const { webContents } = win

  webContents.executeJavaScript(code)
}

function initial() {
  context.mainWindow = createWindow('https://baidu.com')

  context.mainWindow.once('ready-to-show', () => {
    context.mainWindow.webContents.openDevTools({ mode: 'detach' })

    injectHook(context.mainWindow)
  })

  handleListener()
  handleVoice()
}

function handleVoice() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media')
  })
}

function handleListener() {
  ipcMain.on('left-window', (e, url) => {
    const { bounds } = getLeftDisplay()
    const { x, y } = bounds
    context.leftWindow =
      context.leftWindow ||
      createWindow(url, {
        x,
        y
      })

    context.leftWindow.show()
    context.leftWindow.setFullScreen(true)
  })

  ipcMain.on('right-window', (e, url) => {
    const { bounds } = getRightDisplay()
    const { x, y } = bounds
    context.rightWindow =
      context.rightWindow ||
      createWindow(url, {
        x,
        y
      })

    context.rightWindow.show()
    context.rightWindow.setFullScreen(true)
  })
}

app.on('ready', initial)
