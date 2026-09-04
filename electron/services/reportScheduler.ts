import { app, BrowserWindow, powerMonitor } from 'electron'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { getActiveWindowTitle, getActiveWindowRect } from './activeWindow'
import { runWindowsOcrFromBase64 } from './win-ocr'
import { generateReport, llmVisionRecognize } from './llm'
import { getSettings } from './settings'
import { historySave } from './history'
import { captureScreen, preprocessScreenshot, preprocessForVision, listDisplays, findDisplayForWindow, toDisplayRelative } from './screenshot'
import { classifyFromText } from './categories'
import { captureSave, captureListByDate, captureListByRange, captureCountByRange } from './database'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AccumulatedEntry {
  timestamp: number
  ocrText: string
  windowTitle: string
  category: string
  duration: number
}

export interface SchedulerStatus {
  captureActive: boolean
  checkActive: boolean
  isCapturing: boolean
  todayCaptureCount: number
  lastCaptureTime: number | null
  nextReportTime: string | null  // 下次自动报告时间 HH:mm
  autoReportEnabled: boolean
  captureIntervalMinutes: number
}

/* ------------------------------------------------------------------ */
/*  Internal state                                                     */
/* ------------------------------------------------------------------ */

let captureTimer: ReturnType<typeof setInterval> | null = null
let checkTimer: ReturnType<typeof setInterval> | null = null
let isCapturing = false
let lastReportDate = ''
let lastCaptureTimestamp = 0



/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function dateToStr(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '18:00').split(':').map(Number)
  return h * 60 + (m || 0)
}

/* ------------------------------------------------------------------ */
/*  Single capture                                                     */
/* ------------------------------------------------------------------ */

async function captureOnce(): Promise<AccumulatedEntry | null> {
  if (isCapturing) return null
  
  // 闲置检测：如果系统空闲时间超过阈值，跳过采集
  const s = getSettings()
  if (s.idleDetectionEnabled) {
    const idleTime = powerMonitor.getSystemIdleTime()
    const threshold = (s.idleThresholdMinutes || 15) * 60 // 转换为秒
    if (idleTime > threshold) {
      console.log(`[采集] 系统空闲 ${Math.round(idleTime / 60)} 分钟，跳过采集`)
      return null
    }
  }
  
  isCapturing = true
  let lastError = ''
  let debugPath = ''
  try {
    const windowTitle = await getActiveWindowTitle()
    console.log('[采集] 活动窗口:', windowTitle)

    // 锁屏检测：窗口标题为空时通常是锁屏或系统界面，跳过采集
    if (!windowTitle || !windowTitle.trim()) {
      console.log('[采集] 窗口标题为空（可能锁屏），跳过采集')
      return null
    }

    // 获取活动窗口位置（用于裁剪截图）
    const windowRect = await getActiveWindowRect()
    console.log('[采集] 窗口位置:', windowRect)

    // 多屏幕支持：检测活动窗口在哪个显示器上
    const displays = await listDisplays()
    const display = findDisplayForWindow(displays, windowRect)
    const displayId = display?.id
    console.log('[采集] 显示器:', display ? `${display.id} (${display.width}x${display.height}) @ (${display.left},${display.top})` : '主屏幕')

    // 截取活动窗口所在的显示器
    const rawBuf = await captureScreen(displayId)
    console.log('[采集] 原始截图大小:', rawBuf.length, 'bytes')

    if (!display) throw new Error('无法检测到显示器')
    const relativeRect = toDisplayRelative(windowRect, display)

    // 图像预处理：裁剪到活动窗口 + 放大分辨率
    const pngBuf = await preprocessScreenshot(rawBuf, relativeRect)
    console.log('[采集] 预处理后大小:', pngBuf.length, 'bytes')

    // 临时保存截图用于调试（OCR 完成后删除）
    const debugDir = path.join(app.getPath('temp'), 'work-report-capture')
    await mkdir(debugDir, { recursive: true })
    debugPath = path.join(debugDir, `capture-${Date.now()}.png`)
    await writeFile(debugPath, pngBuf)

    let ocrText: string
    const pngBase64 = `data:image/png;base64,${pngBuf.toString('base64')}`

    // 优先使用 LLM 视觉识别
    if (s.llmVisionEnabled && (s.llmVisionModel || s.model)) {
      console.log('[采集] 使用 LLM 视觉识别...')
      try {
        const vision = preprocessForVision(rawBuf, relativeRect)
        console.log('[采集] 视觉预处理完成:', vision.format, '格式')
        ocrText = await llmVisionRecognize(s, vision.dataUrl)
        console.log('[采集] LLM 视觉识别结果长度:', ocrText.length, '字符')
      } catch (e: any) {
        console.warn('[采集] LLM 视觉识别失败，回退到 Windows OCR:', e?.message || e)
        ocrText = await runWindowsOcrFromBase64(pngBase64)
      }
    } else {
      // 回退到 Windows OCR
      ocrText = await runWindowsOcrFromBase64(pngBase64)
      console.log('[采集] OCR 结果长度:', ocrText.length, '字符')
    }

    if (!ocrText || !ocrText.trim()) {
      lastError = 'OCR 返回空文本（截图可能无文字内容）'
      return null
    }

    const now = Date.now()
    const category = classifyFromText(windowTitle, ocrText)
    const duration = lastCaptureTimestamp > 0 ? (now - lastCaptureTimestamp) / 1000 : 0
    lastCaptureTimestamp = now

    return {
      timestamp: now,
      ocrText,
      windowTitle: windowTitle || '未知窗口',
      category,
      duration
    }
  } catch (err: any) {
    lastError = err?.message || String(err)
    console.error('[采集异常]', err)
    return null
  } finally {
    // OCR 完成后删除临时截图
    if (debugPath) {
      unlink(debugPath).catch(() => {})
    }
    isCapturing = false
    if (lastError) {
      console.error('[采集失败]', lastError)
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Scheduler lifecycle                                                */
/* ------------------------------------------------------------------ */

export function startScheduler(getWindow: () => BrowserWindow | null) {
  stopScheduler()
  const s = getSettings()
  lastReportDate = ''

  async function runCaptureCycle() {
    const entry = await captureOnce()
    const win = getWindow()
    if (entry && entry.ocrText.trim()) {
      const today = dateToStr(new Date())
      captureSave(today, entry)
      const count = captureCountByRange(today, today)
      if (win && !win.isDestroyed()) {
        win.webContents.send('scheduler:capture-done', {
          count,
          timestamp: entry.timestamp,
          error: ''
        })
      }
    } else {
      if (win && !win.isDestroyed()) {
        win.webContents.send('scheduler:capture-done', {
          count: captureCountByRange(dateToStr(new Date()), dateToStr(new Date())),
          timestamp: Date.now(),
          error: '采集失败（请查看控制台日志）'
        })
      }
    }
  }

  // --- 定时采集 ---
  if (s.autoCaptureEnabled && s.captureIntervalMinutes > 0) {
    void runCaptureCycle()

    captureTimer = setInterval(() => { runCaptureCycle().catch(err => console.error('[调度器] 采集周期失败:', err)) }, s.captureIntervalMinutes * 60 * 1000)
  }

  // --- 每分钟检查是否到了自动生成报告的时间 ---
  if (s.autoReportEnabled) {
    checkTimer = setInterval(() => {
      const now = new Date()
      const targetMinutes = timeToMinutes(s.autoReportTime || '18:00')
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const todayStr = dateToStr(now)

      const diff = Math.abs(currentMinutes - targetMinutes)
      if (diff <= 1 && lastReportDate !== todayStr) {
        lastReportDate = todayStr
        console.log('[调度器] 触发自动报告生成，时间:', now.toLocaleTimeString('zh-CN'))
        autoGenerateReport(now, getWindow).catch(err => console.error('[调度器] 自动报告生成失败:', err))
      }
    }, 30_000)
  }
}

export function stopScheduler() {
  if (captureTimer) {
    clearInterval(captureTimer)
    captureTimer = null
  }
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
}

/* ------------------------------------------------------------------ */
/*  Auto report generation                                             */
/* ------------------------------------------------------------------ */

async function autoGenerateReport(now: Date, getWindow: () => BrowserWindow | null) {
  const s = getSettings()
  const today = dateToStr(now)
  const entries = captureListByDate(today)

  if (entries.length === 0) return

  const ocrText = entries
    .map((e) => `[${new Date(e.timestamp).toLocaleTimeString('zh-CN')}] ${e.windowTitle}\n${e.ocrText}`)
    .join('\n\n---\n\n')

  const reportType = s.autoReportType || '日报'

  try {
    const reportText = await generateReport(s, {
      reportType,
      startDate: today,
      endDate: today,
      template: '',
      ocrText
    })

    await historySave({
      createdAt: Date.now(),
      reportType,
      startDate: today,
      endDate: today,
      windowTitle: '🤖 自动报告',
      ocrPreview: '',
      reportPreview: '',
      ocrText,
      reportText,
      template: '',
      provider: s.provider,
      model: s.model
    })

    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('scheduler:report-generated', {
        reportType,
        date: today,
        entryCount: entries.length,
        error: ''
      })
    }
  } catch (err: any) {
    console.error('[调度器] 自动报告生成失败:', err?.message || err)
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('scheduler:report-generated', {
        reportType,
        date: today,
        entryCount: entries.length,
        error: `自动${reportType}生成失败：${err?.message || '未知错误'}`
      })
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Public helpers                                                     */
/* ------------------------------------------------------------------ */

/** 获取日期范围内的总条数 */
export function getAccumulatedCount(startDate: string, endDate: string): number {
  return captureCountByRange(startDate, endDate)
}

/** 手动触发一次采集 */
export async function manualCaptureOnce(): Promise<{ entry: AccumulatedEntry | null; error?: string }> {
  try {
    const entry = await captureOnce()
    if (entry && entry.ocrText.trim()) {
      const today = dateToStr(new Date())
      captureSave(today, entry)
      return { entry }
    }
    return { entry: null, error: entry ? 'OCR 文本为空' : '采集失败（详见控制台日志）' }
  } catch (err: any) {
    return { entry: null, error: `采集异常：${err?.message || err}` }
  }
}

/** 从累计采集数据生成报告 */
export async function generateFromAccumulated(
  startDate: string,
  endDate: string,
  reportType: string,
  template: string
): Promise<string> {
  const s = getSettings()
  const allEntries = captureCountByRange(startDate, endDate)

  if (allEntries === 0) {
    throw new Error('选定时间范围内没有已采集的数据，请先启用自动采集或手动采集')
  }

  const allCaptureEntries = captureListByRange(startDate, endDate)

  const ocrText = allCaptureEntries
    .map((e) => `[${new Date(e.timestamp).toLocaleString('zh-CN')}] ${e.windowTitle}\n${e.ocrText}`)
    .join('\n\n---\n\n')

  const reportText = await generateReport(s, {
    reportType,
    startDate,
    endDate,
    template,
    ocrText
  })

  historySave({
    createdAt: Date.now(),
    reportType,
    startDate,
    endDate,
    windowTitle: '📋 从采集数据生成',
    ocrPreview: '',
    reportPreview: '',
    ocrText,
    reportText,
    template,
    provider: s.provider,
    model: s.model
  })

  return reportText
}

/** 获取调度器状态 */
export function getSchedulerStatus(): SchedulerStatus {
  const s = getSettings()
  const today = dateToStr(new Date())
  const count = captureCountByRange(today, today)
  const entries = captureListByDate(today)

  return {
    captureActive: captureTimer !== null,
    checkActive: checkTimer !== null,
    isCapturing,
    todayCaptureCount: count,
    lastCaptureTime: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
    nextReportTime: s.autoReportEnabled ? (s.autoReportTime || '18:00') : null,
    autoReportEnabled: s.autoReportEnabled,
    captureIntervalMinutes: s.captureIntervalMinutes
  }
}
