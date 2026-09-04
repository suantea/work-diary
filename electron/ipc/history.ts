import { ipcMain, dialog, clipboard, app } from 'electron'
import path from 'node:path'
import type { IpcContext } from './context'
import * as historyService from '../services/history'
import { templateList, templateSave, templateDelete, exportAllData, importData, clearAllData } from '../services/database'

export function registerHistoryIpc(ctx: IpcContext) {
  // --- 历史记录 ---
  ipcMain.handle('history:list', async (_e, query: string) => await historyService.historyList(query))
  ipcMain.handle('history:get', async (_e, id: string) => await historyService.historyGet(id))
  ipcMain.handle('history:delete', async (_e, id: string) => {
    await historyService.historyDelete(id)
    return true
  })

  // --- 报告模板 ---
  ipcMain.handle('templates:list', async (_e, reportType?: string) => await templateList(reportType))
  ipcMain.handle('templates:save', async (_e, input) => await templateSave(input))
  ipcMain.handle('templates:delete', async (_e, id: string) => {
    templateDelete(id)
    return true
  })

  // --- 自动导出报告 ---
  ipcMain.handle('report:auto-export', async (_e, params: { reportType: string; startDate: string; endDate: string; content: string }) => {
    const { mkdirSync, existsSync } = await import('node:fs')
    const { writeFile } = await import('node:fs/promises')
    const reportsDir = path.join(app.getPath('userData'), 'reports')
    mkdirSync(reportsDir, { recursive: true })

    if (params.startDate === params.endDate) {
      const fileName = `${params.reportType}_${params.startDate}.md`
      const filePath = path.join(reportsDir, fileName)
      await writeFile(filePath, params.content, 'utf-8')
      console.log(`[导出] 已自动导出: ${filePath}`)
      return { saved: true, path: filePath, type: 'daily' }
    }

    const fileName = `${params.reportType}_${params.startDate}_${params.endDate}.json`
    const filePath = path.join(reportsDir, fileName)
    const exportData = {
      reportType: params.reportType,
      startDate: params.startDate,
      endDate: params.endDate,
      exportedAt: new Date().toISOString(),
      reportContent: params.content
    }
    await writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    console.log(`[导出] 已自动导出: ${filePath}`)
    return { saved: true, path: filePath, type: 'multi-day' }
  })

  // --- 导出 ---
  ipcMain.handle('export:save-file', async (_e, content: string, defaultName: string) => {
    const result = await dialog.showSaveDialog(ctx.getWindow()!, {
      defaultPath: defaultName,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return { saved: false }
    const { writeFile } = await import('node:fs/promises')
    await writeFile(result.filePath, content, 'utf-8')
    return { saved: true, path: result.filePath }
  })

  // --- 导出为图片 ---
  ipcMain.handle('export:to-image', async (_e, dataUrl: string) => {
    const result = await dialog.showSaveDialog(ctx.getWindow()!, {
      defaultPath: 'report.png',
      filters: [{ name: 'PNG', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return { saved: false }
    const { writeFile } = await import('node:fs/promises')
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    await writeFile(result.filePath, Buffer.from(base64, 'base64'))
    return { saved: true, path: result.filePath }
  })

  // --- 复制到剪贴板 ---
  ipcMain.handle('clipboard:write', async (_e, text: string) => {
    clipboard.writeText(text)
    return true
  })
}
