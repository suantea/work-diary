import { ipcMain, dialog } from 'electron'
import type { IpcContext } from './context'
import { exportAllData, importData, clearAllData } from '../services/database'

export function registerDataIpc(ctx: IpcContext) {
  ipcMain.handle('data:export', async () => {
    const result = await dialog.showSaveDialog(ctx.getWindow()!, {
      defaultPath: `work-report-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { saved: false }
    const data = exportAllData()
    const { writeFile } = await import('node:fs/promises')
    await writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { saved: true, path: result.filePath }
  })
  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog(ctx.getWindow()!, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return { imported: false }
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(result.filePaths[0], 'utf-8')
    const data = JSON.parse(content)
    importData(data)
    return { imported: true }
  })
  ipcMain.handle('data:clear', async () => {
    clearAllData()
    return true
  })
}
