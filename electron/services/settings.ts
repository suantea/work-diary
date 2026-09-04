import Store from 'electron-store'
import { safeStorage } from 'electron'

function tryEncrypt(text: string): string {
  if (!text || !safeStorage.isEncryptionAvailable()) return text
  return safeStorage.encryptString(text).toString('base64')
}

function tryDecrypt(encoded: string): string {
  if (!encoded || !safeStorage.isEncryptionAvailable()) return encoded
  try { return safeStorage.decryptString(Buffer.from(encoded, 'base64')) }
  catch { return encoded }
}

export type LlmProvider = 'openrouter' | 'siliconflow' | 'doubao' | 'custom'

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
  // 自动采集与报告
  autoCaptureEnabled: boolean
  captureIntervalMinutes: number
  autoReportEnabled: boolean
  autoReportTime: string // 'HH:mm' 格式
  autoReportType: string
  // LLM 视觉识别
  llmVisionEnabled: boolean
  llmVisionModel: string
  // 闲置检测
  idleDetectionEnabled: boolean
  idleThresholdMinutes: number
  // 快捷键
  captureHotkey: string
  // 开机自启
  launchAtLogin: boolean
  // WebDAV 备份
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavSyncInterval: number  // 分钟，0=手动
  webdavSyncOnStartup: boolean
  webdavLastSyncTime: number  // 时间戳
}

const store = new Store<Settings>({
  name: 'settings',
  defaults: {
    provider: 'openrouter',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterApiKey: '',
    siliconflowBaseUrl: 'https://api.siliconflow.cn/v1',
    siliconflowApiKey: '',
    doubaoBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    doubaoApiKey: '',
    customBaseUrl: '',
    customApiKey: '',
    model: '',
    captureMode: 'active_window',
    preferredWindowSourceId: '',
    autoCaptureEnabled: true,
    captureIntervalMinutes: 5,
    autoReportEnabled: false,
    autoReportTime: '18:00',
    autoReportType: '日报',
    llmVisionEnabled: false,
    llmVisionModel: '',
    idleDetectionEnabled: true,
    idleThresholdMinutes: 15,
    captureHotkey: 'Ctrl+Shift+Y',
    launchAtLogin: false,
    webdavEnabled: false,
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    webdavSyncInterval: 0,
    webdavSyncOnStartup: false,
    webdavLastSyncTime: 0
  }
})

export function getSettings(): Settings {
  const s = { ...store.store }
  if (s.webdavPassword) s.webdavPassword = tryDecrypt(s.webdavPassword)
  return s
}

export function setSettings(patch: Partial<Settings>): Settings {
  const { webdavPassword, ...rest } = patch
  const next = { ...store.store, ...rest }
  if (webdavPassword !== undefined) {
    next.webdavPassword = tryEncrypt(webdavPassword)
  }
  store.store = next
  return getSettings()
}
