import { BrowserWindow, ipcMain } from 'electron'
import { getSettings } from '../services/settings'
import { generateReport, generateReportStream } from '../services/llm'
import { getActiveWindowTitle } from '../services/activeWindow'
import { historySave } from '../services/history'

export function registerLlmIpc() {
  // --- LLM 报告生成 ---
  ipcMain.handle('llm:generate', async (_e, params) => {
    const s = getSettings()
    const reportText = await generateReport(s, params)
    const windowTitle = (await getActiveWindowTitle()) || ''
    await historySave({
      createdAt: Date.now(),
      reportType: params?.reportType ?? '',
      startDate: params?.startDate ?? '',
      endDate: params?.endDate ?? '',
      windowTitle,
      ocrPreview: '',
      reportPreview: '',
      ocrText: params?.ocrText ?? '',
      reportText,
      template: params?.template ?? '',
      provider: s.provider,
      model: s.model
    })
    return reportText
  })

  // --- 流式 LLM 生成 ---
  ipcMain.handle('llm:generate-stream', async (e, params) => {
    const s = getSettings()
    const win = BrowserWindow.fromWebContents(e.sender)
    let fullText = ''
    try {
      fullText = await generateReportStream(s, params, (chunk) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('report:stream-chunk', chunk)
        }
      })
      const windowTitle = (await getActiveWindowTitle()) || ''
      await historySave({
        createdAt: Date.now(),
        reportType: params?.reportType ?? '',
        startDate: params?.startDate ?? '',
        endDate: params?.endDate ?? '',
        windowTitle,
        ocrPreview: '',
        reportPreview: '',
        ocrText: params?.ocrText ?? '',
        reportText: fullText,
        template: params?.template ?? '',
        provider: s.provider,
        model: s.model
      })
      if (win && !win.isDestroyed()) {
        win.webContents.send('report:stream-done', fullText)
      }
    } catch (err: any) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('report:stream-error', err?.message || String(err))
      }
    }
    return fullText
  })
}
