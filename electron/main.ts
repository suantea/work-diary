import { BrowserWindow, Menu, Tray, app, globalShortcut, nativeImage } from 'electron'
import path from 'node:path'
import { getSettings, setSettings } from './services/settings'
import { startScheduler, stopScheduler } from './services/reportScheduler'
import { closeDb } from './services/history'
import { registerWindowIpc } from './ipc/window'
import { registerSettingsIpc } from './ipc/settings'
import { registerLlmIpc } from './ipc/llm'
import { registerCapturesIpc } from './ipc/captures'
import { registerHistoryIpc } from './ipc/history'
import { registerDataIpc } from './ipc/data'
import { registerWebdavIpc } from './ipc/webdav'
import { registerSchedulerIpc } from './ipc/scheduler'
import type { IpcContext } from './ipc/context'

app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isRestarting = false
let isQuitting = false

/* ------------------------------------------------------------------ */
/*  Window                                                             */
/* ------------------------------------------------------------------ */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    titleBarStyle: 'hidden',
    icon: loadAppIcon(64),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(path.join(process.env.VITE_PUBLIC || path.join(__dirname, '..', 'dist'), 'index.html'))
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (!isRestarting && !isQuitting) {
      isRestarting = true
      setTimeout(() => {
        createMainWindow()
        isRestarting = false
      }, 500)
    }
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] 渲染进程崩溃:', details.reason, details.exitCode)
    mainWindow = null
    if (!isQuitting) {
      setTimeout(() => createMainWindow(), 1000)
    }
  })

  mainWindow.on('unresponsive', () => {
    console.warn('[Main] 窗口无响应，尝试恢复')
    if (mainWindow) {
      mainWindow.webContents.forcefullyCrashRenderer()
    }
  })

  const notifyState = (state: string) => {
    mainWindow?.webContents.send('window-state-changed', state)
  }
  mainWindow.on('maximize', () => notifyState('maximized'))
  mainWindow.on('unmaximize', () => notifyState('normal'))
  mainWindow.on('minimize', () => notifyState('minimized'))
  mainWindow.on('enter-full-screen', () => notifyState('full-screen'))
  mainWindow.on('leave-full-screen', () => notifyState('normal'))
}

function registerShortcuts() {
  globalShortcut.unregisterAll()
  const s = getSettings()
  const hotkey = s.captureHotkey || 'Ctrl+Shift+Y'
  try {
    globalShortcut.register(hotkey, () => {
      if (!mainWindow) return
      mainWindow.webContents.send('hotkey:capture')
    })
    console.log(`[Shortcut] 已注册: ${hotkey}`)
  } catch (err) {
    console.error(`[Shortcut] 注册失败: ${hotkey}`, err)
    try {
      globalShortcut.register('Ctrl+Shift+Y', () => {
        if (!mainWindow) return
        mainWindow.webContents.send('hotkey:capture')
      })
    } catch {}
  }
}

function getWindow(): BrowserWindow | null {
  return mainWindow
}

/* ------------------------------------------------------------------ */
/*  Tray                                                               */
/* ------------------------------------------------------------------ */

function loadAppIcon(size: number) {
  const iconPath = path.join(__dirname, '..', 'icons', `icon-${size}.png`)
  try {
    return nativeImage.createFromPath(iconPath)
  } catch (err) {
    console.error('[Icon] 加载图标失败:', iconPath, err)
    const buf = Buffer.alloc(size * size * 4)
    for (let i = 0; i < size * size; i++) {
      buf[i * 4] = 82; buf[i * 4 + 1] = 196; buf[i * 4 + 2] = 26; buf[i * 4 + 3] = 255
    }
    return nativeImage.createFromBuffer(buf, { width: size, height: size })
  }
}

function createTrayIcon() {
  const img = loadAppIcon(16)
  tray = new Tray(img)
  tray.setToolTip('asuan 工作助手 - 运行中')
  updateTrayMenu()
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function updateTrayMenu() {
  if (!tray) return
  const s = getSettings()
  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    {
      label: s.autoCaptureEnabled ? '● 自动采集：运行中' : '○ 自动采集：已停止',
      enabled: false
    },
    {
      label: s.autoCaptureEnabled ? '停止采集' : '开始采集',
      click: () => {
        setSettings({ autoCaptureEnabled: !s.autoCaptureEnabled })
        startScheduler(getWindow)
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit() } }
  ])
  tray.setContextMenu(menu)
}

/* ------------------------------------------------------------------ */
/*  IPC                                                                */
/* ------------------------------------------------------------------ */

function registerIpc() {
  const ctx: IpcContext = { getWindow, updateTrayMenu, registerShortcuts }
  registerWindowIpc(ctx)
  registerSettingsIpc(ctx)
  registerLlmIpc()
  registerCapturesIpc()
  registerHistoryIpc(ctx)
  registerDataIpc(ctx)
  registerWebdavIpc()
  registerSchedulerIpc(ctx)
}

/* ------------------------------------------------------------------ */
/*  Global error handlers                                              */
/* ------------------------------------------------------------------ */

process.on('uncaughtException', (err) => {
  console.error('[Main] 未捕获异常:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Main] 未处理的 Promise 拒绝:', reason)
})

app.on('before-quit', () => {
  isQuitting = true
})

/* ------------------------------------------------------------------ */
/*  App lifecycle                                                      */
/* ------------------------------------------------------------------ */

app.whenReady().then(() => {
  registerIpc()
  createMainWindow()
  registerShortcuts()
  createTrayIcon()
  startScheduler(getWindow)

  const s = getSettings()
  app.setLoginItemSettings({
    openAtLogin: s.launchAtLogin || false
  })

  // WebDAV 启动同步
  if (s.webdavEnabled && s.webdavSyncOnStartup && s.webdavUrl) {
    import('./services/webdav').then(async ({ webdavSyncDown }) => {
      console.log('[WebDAV] 启动时自动恢复数据...')
      const result = await webdavSyncDown()
      console.log('[WebDAV]', result.message)
      if (result.ok && result.timestamp) {
        setSettings({ webdavLastSyncTime: result.timestamp })
      }
    }).catch(err => console.error('[WebDAV] 启动同步失败:', err))
  }

  let webdavTimer: ReturnType<typeof setInterval> | null = null
  function startWebdavTimer() {
    if (webdavTimer) clearInterval(webdavTimer)
    const cfg = getSettings()
    if (cfg.webdavEnabled && cfg.webdavSyncInterval > 0 && cfg.webdavUrl) {
      webdavTimer = setInterval(async () => {
        try {
          const { webdavSyncUp } = await import('./services/webdav')
          const result = await webdavSyncUp()
          if (result.ok) setSettings({ webdavLastSyncTime: result.timestamp })
          console.log('[WebDAV] 定时上传:', result.message)
        } catch (err) {
          console.error('[WebDAV] 定时上传失败:', err)
        }
      }, cfg.webdavSyncInterval * 60 * 1000)
    }
  }
  startWebdavTimer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('will-quit', () => {
  stopScheduler()
  closeDb()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {})
