import { ipcMain } from 'electron'
import type { IpcContext } from './context'
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  manualCaptureOnce,
  generateFromAccumulated,
  getAccumulatedCount
} from '../services/reportScheduler'

export function registerSchedulerIpc(ctx: IpcContext) {
  ipcMain.handle('scheduler:start', async () => startScheduler(ctx.getWindow))
  ipcMain.handle('scheduler:stop', async () => stopScheduler())
  ipcMain.handle('scheduler:status', async () => await getSchedulerStatus())
  ipcMain.handle('scheduler:capture-once', async () => await manualCaptureOnce())
  ipcMain.handle('scheduler:generate-report', async (_e, params) =>
    await generateFromAccumulated(params.startDate, params.endDate, params.reportType, params.template)
  )
  ipcMain.handle('scheduler:accumulated-count', async (_e, startDate: string, endDate: string) =>
    await getAccumulatedCount(startDate, endDate)
  )
}
