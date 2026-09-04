import { contextBridge, ipcRenderer } from 'electron'

/* ------------------------------------------------------------------ */
/*  Expose to renderer                                                 */
/* ------------------------------------------------------------------ */

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // 窗口控制
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowStateChanged: (cb: (state: string) => void) => {
    const handler = (_e: any, state: string) => cb(state)
    ipcRenderer.on('window-state-changed', handler)
    return () => { ipcRenderer.removeListener('window-state-changed', handler) }
  },

  // 设置
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch: any) => ipcRenderer.invoke('settings:set', patch),

  // 截图（优先使用 screenshot-desktop，更可靠）
  captureScreenPngBase64: () => ipcRenderer.invoke('screenshot:capture'),
  // 兼容旧接口
  capturePrimaryScreenPngBase64: () => ipcRenderer.invoke('screenshot:capture'),
  captureActiveWindowPngBase64: () => ipcRenderer.invoke('screenshot:capture'),

  // OCR
  ocrRun: (pngBase64: string) => ipcRenderer.invoke('ocr:run', pngBase64),

  // LLM
  llmGenerate: (params: any) => ipcRenderer.invoke('llm:generate', params),
  llmGenerateStream: (params: any) => ipcRenderer.invoke('llm:generate-stream', params),
  llmTestApi: (params: any) => ipcRenderer.invoke('llm:test-api', params),
  llmTestVision: (params: any) => ipcRenderer.invoke('llm:test-vision', params),
  onStreamChunk: (cb: (chunk: string) => void) => {
    const handler = (_e: any, chunk: string) => cb(chunk)
    ipcRenderer.on('report:stream-chunk', handler)
    return () => { ipcRenderer.removeListener('report:stream-chunk', handler) }
  },
  onStreamDone: (cb: (fullText: string) => void) => {
    const handler = (_e: any, fullText: string) => cb(fullText)
    ipcRenderer.on('report:stream-done', handler)
    return () => { ipcRenderer.removeListener('report:stream-done', handler) }
  },
  onStreamError: (cb: (error: string) => void) => {
    const handler = (_e: any, error: string) => cb(error)
    ipcRenderer.on('report:stream-error', handler)
    return () => { ipcRenderer.removeListener('report:stream-error', handler) }
  },

  // 历史记录
  historyList: (query: string) => ipcRenderer.invoke('history:list', query),
  historyGet: (id: string) => ipcRenderer.invoke('history:get', id),
  historyDelete: (id: string) => ipcRenderer.invoke('history:delete', id),

  // 报告模板
  templatesList: (reportType?: string) => ipcRenderer.invoke('templates:list', reportType),
  templatesSave: (input: any) => ipcRenderer.invoke('templates:save', input),
  templatesDelete: (id: string) => ipcRenderer.invoke('templates:delete', id),

  // 数据管理
  dataExport: () => ipcRenderer.invoke('data:export'),
  dataImport: () => ipcRenderer.invoke('data:import'),
  dataClear: () => ipcRenderer.invoke('data:clear'),

  // WebDAV 备份
  webdavTest: (url: string, username: string, password: string) => ipcRenderer.invoke('webdav:test', url, username, password),
  webdavSyncUp: () => ipcRenderer.invoke('webdav:sync-up'),
  webdavSyncDown: () => ipcRenderer.invoke('webdav:sync-down'),
  webdavStatus: () => ipcRenderer.invoke('webdav:status'),

  // 调度器
  schedulerStart: () => ipcRenderer.invoke('scheduler:start'),
  schedulerStop: () => ipcRenderer.invoke('scheduler:stop'),
  schedulerStatus: () => ipcRenderer.invoke('scheduler:status'),
  schedulerCaptureOnce: () => ipcRenderer.invoke('scheduler:capture-once'),
  schedulerGenerateReport: (params: any) => ipcRenderer.invoke('scheduler:generate-report', params),
  schedulerAccumulatedCount: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('scheduler:accumulated-count', startDate, endDate),

  // 窗口使用统计
  statsWindowUsage: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('stats:window-usage', startDate, endDate),

  // 采集数据列表
  capturesListByDate: (date: string) =>
    ipcRenderer.invoke('captures:list-by-date', date),
  capturesListByRange: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('captures:list-by-range', startDate, endDate),

  // 应用使用统计
  statsAppUsage: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('stats:app-usage', startDate, endDate),

  // 工作记录
  workRecordsListByDate: (date: string) =>
    ipcRenderer.invoke('work-records:list-by-date', date),
  workRecordsListByDateRange: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('work-records:list-by-date-range', startDate, endDate),

  // 导出
  exportSaveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke('export:save-file', content, defaultName),
  exportToImage: (dataUrl: string) => ipcRenderer.invoke('export:to-image', dataUrl),
  clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  // 自动导出报告
  reportAutoExport: (params: { reportType: string; startDate: string; endDate: string; content: string }) =>
    ipcRenderer.invoke('report:auto-export', params),

  // 热键 & 事件
  onHotkeyCapture: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('hotkey:capture', handler)
    return () => { ipcRenderer.off('hotkey:capture', handler) }
  },
  onSchedulerCaptureDone: (cb: (info: { count: number; timestamp: number; error?: string }) => void) => {
    const handler = (_e: any, info: any) => cb(info)
    ipcRenderer.on('scheduler:capture-done', handler)
    return () => { ipcRenderer.off('scheduler:capture-done', handler) }
  },
  onSchedulerReportGenerated: (cb: (info: { reportType: string; date: string; entryCount: number; error?: string }) => void) => {
    const handler = (_e: any, info: any) => cb(info)
    ipcRenderer.on('scheduler:report-generated', handler)
    return () => { ipcRenderer.off('scheduler:report-generated', handler) }
  }
})
