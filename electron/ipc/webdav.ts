import { ipcMain } from 'electron'
import { setSettings } from '../services/settings'
import { webdavTestConnection, webdavSyncUp, webdavSyncDown, webdavStatus } from '../services/webdav'

export function registerWebdavIpc() {
  ipcMain.handle('webdav:test', async (_e, url: string, username: string, password: string) => {
    return await webdavTestConnection(url, username, password)
  })
  ipcMain.handle('webdav:sync-up', async () => {
    const result = await webdavSyncUp()
    if (result.ok) setSettings({ webdavLastSyncTime: result.timestamp })
    return result
  })
  ipcMain.handle('webdav:sync-down', async () => {
    const result = await webdavSyncDown()
    if (result.ok) setSettings({ webdavLastSyncTime: result.timestamp })
    return result
  })
  ipcMain.handle('webdav:status', async () => {
    return await webdavStatus()
  })
}
