const { app, BrowserWindow, ipcMain, screen, protocol, session } = require('electron')
const path = require('path')
const fs = require('fs')

// 部署到场外打包时
// const ip = '192.168.2.12' // 场外基地ip

// 部署到场内
// const ip = '192.168.2.15' // 智元场内ip

const p = path.join(process.cwd(), 'ip.txt')

const ip = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '192.168.2.12'

app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-origin', `http://${ip}:30734`)
// 不支持了
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', `http://${ip}:30734`)
//解决10.X版本跨域不成功问题(上线删除)
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors')
const context = {
  mainWindow: null,
  leftWindow: null,
  rightWindow: null
}

// 必须在 app ready 之前注册
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'http',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

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
      webviewTag: true,
      webSecurity: false,
      experimentalFeatures: true
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
  // context.mainWindow = createWindow('http://localhost:3000/Maps')
  context.mainWindow = createWindow(`https://${ip}:30734/login`)

  context.mainWindow.once('ready-to-show', () => {
    // 打开控制台
    // context.mainWindow.webContents.openDevTools({ mode: 'detach' })
    context.mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
      if (url === `http://${ip}:30734/maps`) {
        injectHook(context.mainWindow)
      }
    })
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
    if (!context.leftWindow) {
      context.leftWindow = createWindow(url, { x, y })
      context.leftWindow.show()
    } else {
      context.leftWindow.loadURL(url)
    }
    context.leftWindow.setFullScreen(true)
  })

  ipcMain.on('right-window', (e, url) => {
    const { bounds } = getRightDisplay()
    const { x, y } = bounds
    if (!context.rightWindow) {
      context.rightWindow = createWindow(url, { x, y })
      context.rightWindow.show()
    } else {
      context.rightWindow.loadURL(url)
    }
    context.rightWindow.setFullScreen(true)
  })
}

app.on('ready', initial)
