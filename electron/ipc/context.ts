import type { BrowserWindow } from 'electron'

export interface IpcContext {
  getWindow: () => BrowserWindow | null
  updateTrayMenu?: () => void
  registerShortcuts?: () => void
}
