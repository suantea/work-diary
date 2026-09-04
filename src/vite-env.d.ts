/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

export type LlmProvider = 'openrouter' | 'siliconflow' | 'doubao' | 'custom'

export type ReportType = '日报' | '周报' | '月报' | '半年报' | '年报' | '自定义'

export type NavPage = 'dashboard' | 'generate' | 'timeline' | 'heatmap' | 'app-usage' | 'history' | 'agent-api' | 'settings' | 'report-detail' | 'capture-detail'

export interface Settings {
  provider: LlmProvider
  openrouterBaseUrl: string
  openrouterApiKey: string
  siliconflowBaseUrl: string
  siliconflowApiKey: string
  doubaoBaseUrl: string
  doubaoApiKey: string
  customBaseUrl: string
  customApiKey: string
  model: string
  captureMode: 'active_window' | 'primary_screen'
  preferredWindowSourceId: string
  autoCaptureEnabled: boolean
  captureIntervalMinutes: number
  autoReportEnabled: boolean
  autoReportTime: string
  autoReportType: string
  llmVisionEnabled: boolean
  llmVisionModel: string
  idleDetectionEnabled: boolean
  idleThresholdMinutes: number
  captureHotkey: string
  launchAtLogin: boolean
  // WebDAV 备份
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavSyncInterval: number
  webdavSyncOnStartup: boolean
  webdavLastSyncTime: number
}

export interface GenerateParams {
  reportType: ReportType
  startDate: string
  endDate: string
  template: string
  ocrText: string
}

export interface HistoryListItem {
  id: string
  createdAt: number
  reportType: string
  startDate: string
  endDate: string
  windowTitle: string
  ocrPreview: string
  reportPreview: string
}

export interface HistoryItem extends HistoryListItem {
  ocrText: string
  reportText: string
  template: string
  provider: string
  model: string
}

export interface SchedulerStatus {
  captureActive: boolean
  checkActive: boolean
  isCapturing: boolean
  todayCaptureCount: number
  lastCaptureTime: number | null
  nextReportTime: string | null
  autoReportEnabled: boolean
  captureIntervalMinutes: number
}

export interface AccumulatedEntry {
  timestamp: number
  ocrText: string
  windowTitle: string
}

export interface WindowUsageStat {
  windowTitle: string
  count: number
  percentage: number
  firstTime: string
  lastTime: string
}

export interface CapturesListItem {
  id: number
  date: string
  timestamp: number
  ocrText: string
  windowTitle: string
  category: string
  duration: number
}

export interface WorkRecord {
  id: number
  timestamp: number
  category: string
  description: string
  appName: string
  windowTitle: string
  duration: number
  displayId: number
  isPrivate: boolean
  rawText: string
  createdAt: number
}

export interface TemplateItem {
  id: string
  name: string
  reportType: string
  content: string
  createdAt: number
  updatedAt: number
}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      // 窗口控制
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      onWindowStateChanged: (cb: (state: string) => void) => () => void
      // 设置
      settingsGet: () => Promise<Settings>
      settingsSet: (patch: Partial<Settings>) => Promise<Settings>
      // 截图
      capturePrimaryScreenPngBase64: () => Promise<string>
      captureActiveWindowPngBase64: () => Promise<string>
      // OCR
      ocrRun: (pngBase64: string) => Promise<string>
      // LLM
      llmGenerate: (params: GenerateParams) => Promise<string>
      llmGenerateStream: (params: GenerateParams) => Promise<string>
      llmTestApi: (params: any) => Promise<string>
      llmTestVision: (params: any) => Promise<string>
      onStreamChunk: (cb: (chunk: string) => void) => () => void
      onStreamDone: (cb: (fullText: string) => void) => () => void
      onStreamError: (cb: (error: string) => void) => () => void
      // 历史记录
      historyList: (query: string) => Promise<HistoryListItem[]>
      historyGet: (id: string) => Promise<HistoryItem>
      historyDelete: (id: string) => Promise<boolean>
      // 报告模板
      templatesList: (reportType?: string) => Promise<TemplateItem[]>
      templatesSave: (input: { name: string; reportType: string; content: string; id?: string }) => Promise<TemplateItem>
      templatesDelete: (id: string) => Promise<boolean>
      // 数据管理
      dataExport: () => Promise<{ saved: boolean; path?: string }>
      dataImport: () => Promise<{ imported: boolean }>
      dataClear: () => Promise<boolean>
      // WebDAV 备份
      webdavTest: (url: string, username: string, password: string) => Promise<{ ok: boolean; message: string }>
      webdavSyncUp: () => Promise<{ ok: boolean; message: string; timestamp: number }>
      webdavSyncDown: () => Promise<{ ok: boolean; message: string; timestamp: number }>
      webdavStatus: () => Promise<{ exists: boolean; lastSyncTime: number }>
      // 调度器
      schedulerStart: () => Promise<void>
      schedulerStop: () => Promise<void>
      schedulerStatus: () => Promise<SchedulerStatus>
      schedulerCaptureOnce: () => Promise<{ entry: AccumulatedEntry | null; error?: string }>
      schedulerGenerateReport: (params: {
        startDate: string
        endDate: string
        reportType: string
        template: string
      }) => Promise<string>
      schedulerAccumulatedCount: (startDate: string, endDate: string) => Promise<number>
      statsWindowUsage: (startDate: string, endDate: string) => Promise<WindowUsageStat[]>
      capturesListByDate: (date: string) => Promise<CapturesListItem[]>
      capturesListByRange: (startDate: string, endDate: string) => Promise<CapturesListItem[]>
      // 应用使用统计
      statsAppUsage: (startDate: string, endDate: string) => Promise<{ id: number; date: string; appName: string; totalDuration: number; firstUsed: number | null; lastUsed: number | null; usageCount: number }[]>
      // 工作记录
      workRecordsListByDate: (date: string) => Promise<WorkRecord[]>
      workRecordsListByDateRange: (startDate: string, endDate: string) => Promise<WorkRecord[]>
      // 导出
      exportSaveFile: (content: string, defaultName: string) => Promise<{ saved: boolean; path?: string }>
      exportToImage: (dataUrl: string) => Promise<{ saved: boolean; path?: string }>
      clipboardWrite: (text: string) => Promise<boolean>
      reportAutoExport: (params: { reportType: string; startDate: string; endDate: string; content: string }) => Promise<{ saved: boolean; path?: string; type?: string }>
      // 事件
      onHotkeyCapture: (cb: () => void) => () => void
      onSchedulerCaptureDone: (cb: (info: { count: number; timestamp: number; error?: string }) => void) => () => void
      onSchedulerReportGenerated: (cb: (info: { reportType: string; date: string; entryCount: number; error?: string }) => void) => () => void
    }
  }
}

export {}
