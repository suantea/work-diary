import { ipcMain } from 'electron'
import { captureScreenBase64 } from '../services/screenshot'
import { runWindowsOcrFromBase64 } from '../services/win-ocr'
import { getActiveWindowTitle } from '../services/activeWindow'
import { captureListByDate, captureListByRange, getWindowUsageStats, appStatsQueryByDateRange, workRecordsQueryByDate, workRecordsQueryByDateRange } from '../services/database'

export function registerCapturesIpc() {
  // --- 活动窗口 ---
  ipcMain.handle('window:activeTitle', async () => await getActiveWindowTitle())

  // --- 截图 ---
  ipcMain.handle('screenshot:capture', async () => {
    return await captureScreenBase64()
  })

  // --- OCR (Windows OCR) ---
  ipcMain.handle('ocr:run', async (_e, pngBase64: string) => {
    return await runWindowsOcrFromBase64(pngBase64)
  })

  // --- 采集数据列表 ---
  ipcMain.handle('captures:list-by-date', async (_e, date: string) => {
    return captureListByDate(date)
  })
  ipcMain.handle('captures:list-by-range', async (_e, startDate: string, endDate: string) => {
    return captureListByRange(startDate, endDate)
  })

  // --- 窗口使用统计 ---
  ipcMain.handle('stats:window-usage', async (_e, startDate: string, endDate: string) =>
    getWindowUsageStats(startDate, endDate)
  )

  // --- 应用使用统计 ---
  ipcMain.handle('stats:app-usage', async (_e, startDate: string, endDate: string) => {
    return appStatsQueryByDateRange(startDate, endDate)
  })

  // --- 工作记录 ---
  ipcMain.handle('work-records:list-by-date', async (_e, date: string) => {
    return workRecordsQueryByDate(date)
  })
  ipcMain.handle('work-records:list-by-date-range', async (_e, startDate: string, endDate: string) => {
    return workRecordsQueryByDateRange(startDate, endDate)
  })
}
