import { ipcMain, app } from 'electron'
import type { IpcContext } from './context'

export function registerWindowIpc(ctx: IpcContext) {
  ipcMain.on('window:minimize', () => ctx.getWindow()?.minimize())
  ipcMain.on('window:maximize', () => {
    const w = ctx.getWindow()
    if (w?.isMaximized()) w.unmaximize()
    else w?.maximize()
  })
  ipcMain.on('window:close', () => ctx.getWindow()?.close())
  ipcMain.handle('window:is-maximized', () => ctx.getWindow()?.isMaximized() ?? false)
  ipcMain.handle('app:get-version', () => app.getVersion())
}
