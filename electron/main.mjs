import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  net,
  protocol,
  session,
} from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_ROOT = path.resolve(__dirname, '../dist')
const DEV_URL = process.env.ELECTRON_RENDERER_URL

let mainWindow = null
let clickThrough = false
let alwaysOnTop = true

app.setName('Blinkline')
app.commandLine.appendSwitch('enable-transparent-visuals')
if (process.platform === 'linux' && process.env.BLINKLINE_OZONE_PLATFORM) {
  app.commandLine.appendSwitch(
    'ozone-platform',
    process.env.BLINKLINE_OZONE_PLATFORM,
  )
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const isTrustedPage = (url) =>
  url.protocol === 'app:' ||
  url.hostname === '127.0.0.1' ||
  url.hostname === 'localhost'

const setClickThrough = (enabled) => {
  clickThrough = enabled
  mainWindow?.setIgnoreMouseEvents(enabled, { forward: true })
}

const setAlwaysOnTop = (enabled) => {
  alwaysOnTop = enabled
  mainWindow?.setAlwaysOnTop(enabled, 'floating')
}

const registerShortcuts = () => {
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    setClickThrough(!clickThrough)
  })
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    setAlwaysOnTop(!alwaysOnTop)
  })
}

const showContextMenu = () => {
  if (!mainWindow) return

  Menu.buildFromTemplate([
    {
      label: '点击穿透',
      type: 'checkbox',
      checked: clickThrough,
      click: (item) => setClickThrough(item.checked),
    },
    {
      label: '保持置顶',
      type: 'checkbox',
      checked: alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked),
    },
    { type: 'separator' },
    {
      label: '重新加载',
      click: () => mainWindow?.reload(),
    },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]).popup({ window: mainWindow })
}

const registerLocalProtocol = () => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    const relativePath =
      decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
    const filePath = path.resolve(DIST_ROOT, relativePath)
    const isInsideDist =
      filePath === DIST_ROOT || filePath.startsWith(`${DIST_ROOT}${path.sep}`)

    if (!isInsideDist) {
      return new Response('Not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

const configurePermissions = () => {
  const isCameraAllowed = (webContents, permission, details = {}) => {
    if (!webContents) return false

    let pageUrl
    try {
      pageUrl = new URL(webContents.getURL())
    } catch {
      return false
    }

    const mediaTypes = details.mediaTypes ?? []
    const requestsCamera =
      mediaTypes.length === 0 || mediaTypes.includes('video')

    return (
      permission === 'media' &&
      requestsCamera &&
      isTrustedPage(pageUrl)
    )
  }

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      callback(isCameraAllowed(webContents, permission, details))
    },
  )

  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, _origin, details) =>
      isCameraAllowed(webContents, permission, details),
  )
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 280,
    minHeight: 360,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('context-menu', showContextMenu)
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (DEV_URL) {
    const rendererUrl = new URL(DEV_URL)
    rendererUrl.searchParams.set('embed', '1')
    rendererUrl.searchParams.set('desktop', '1')
    void mainWindow.loadURL(rendererUrl.toString())
  } else {
    void mainWindow.loadURL('app://bundle/index.html?embed=1&desktop=1')
  }
}

const hasLock = app.requestSingleInstanceLock()

if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    registerLocalProtocol()
    configurePermissions()
    createWindow()
    registerShortcuts()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
