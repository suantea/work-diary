<template>
  <div class="app">
    <Titlebar :running="schedulerRunning" :count="captureCount" />
    <Sidebar :active="currentPage" @update:active="currentPage = $event" />

    <!-- ====== Main Content ====== -->
    <div class="main-content">

      <DashboardPage v-if="currentPage === 'dashboard'" @navigate="currentPage = $event" @open-history="openHistory" />

      <!-- ==================== REPORT DETAIL ==================== -->
      <ReportDetailPage v-if="currentPage === 'report-detail'" :report="selectedReport" @back="currentPage = 'history'" @copy="copyReport" @export="exportReport" @delete="deleteHistory" />

      <!-- ==================== CAPTURE DETAIL ==================== -->
      <CaptureDetailPage v-if="currentPage === 'capture-detail'" :captures="todayCaptures" @back="currentPage = 'dashboard'" />

      <GenerateReportPage v-if="currentPage === 'generate'" />

      <!-- ==================== TIMELINE PAGE ==================== -->
      <TimelinePage v-if="currentPage === 'timeline'" />

      <!-- ==================== HEATMAP PAGE ==================== -->
      <HeatmapPage v-if="currentPage === 'heatmap'" />

      <!-- ==================== APP USAGE PAGE ==================== -->
      <AppUsagePage v-if="currentPage === 'app-usage'" />
      <AgentApiPage v-if="currentPage === 'agent-api'" />
      <!-- ==================== HISTORY PAGE ==================== -->
      <HistoryPage v-if="currentPage === 'history'" :items="historyItems" :selected-id="selectedHistoryId" v-model:query="historyQuery" @open="openHistory" @delete="deleteHistory" />

      <SettingsPage v-if="currentPage === 'settings'" :settings="settings" @refresh-data="refreshDataAfterSettings" />

    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { toYmd, formatTs } from './utils/date'
import Titlebar from './components/Titlebar.vue'
import Sidebar from './components/Sidebar.vue'
import DashboardPage from './pages/Dashboard.vue'
import SettingsPage from './pages/Settings.vue'
import AgentApiPage from './pages/AgentApi.vue'
import ReportDetailPage from './pages/ReportDetail.vue'
import CaptureDetailPage from './pages/CaptureDetail.vue'
import GenerateReportPage from './pages/GenerateReport.vue'
import TimelinePage from './pages/Timeline.vue'
import HeatmapPage from './pages/Heatmap.vue'
import AppUsagePage from './pages/AppUsage.vue'
import HistoryPage from './pages/History.vue'
import type { HistoryListItem, NavPage, Settings } from './vite-env'

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

const winApi = window.electronAPI

const currentPage = ref<NavPage>('dashboard')
const busy = ref(false)
const runStatus = ref('')

const settings = reactive<Settings>({
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
  captureIntervalMinutes: 30,
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
})

const historyQuery = ref('')
const historyItems = ref<HistoryListItem[]>([])
const selectedHistoryId = ref('')

const captureCount = ref(0)
const lastCaptureTimeStr = ref('')
const schedulerRunning = ref(false)

const todayCaptures = ref<{ timestamp: number; ocrText: string; windowTitle: string; category: string }[]>([])
const selectedReport = ref<any>(null)

/* ------------------------------------------------------------------ */
/*  Computed                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

async function loadSettings() {
  const s = await winApi.settingsGet()
  Object.assign(settings, s)
}

async function manualCapture() {
  runStatus.value = '采集中...'
  busy.value = true
  try {
    const result = await winApi.schedulerCaptureOnce()
    if (result.entry) {
      captureCount.value++
      lastCaptureTimeStr.value = formatTs(result.entry.timestamp)
      runStatus.value = `采集成功`
      await refreshTodayCaptures()
    } else {
      runStatus.value = result.error || '采集失败'
    }
  } catch (e: any) {
    runStatus.value = e?.message || '未知错误'
  } finally {
    busy.value = false
    setTimeout(() => { runStatus.value = '' }, 3000)
  }
}

async function copyReport() {
  if (!selectedReport.value?.reportText) return
  try {
    await winApi.clipboardWrite(selectedReport.value.reportText)
    runStatus.value = '已复制到剪贴板'
  } catch {
    const ta = document.createElement('textarea')
    ta.value = selectedReport.value.reportText
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    runStatus.value = '已复制到剪贴板'
  }
  setTimeout(() => { runStatus.value = '' }, 2000)
}

async function exportReport() {
  if (!selectedReport.value?.reportText) return
  const defaultName = `${selectedReport.value.reportType}_${selectedReport.value.startDate}.md`
  try {
    const result = await winApi.exportSaveFile(selectedReport.value.reportText, defaultName)
    if (result.saved) {
      runStatus.value = `已导出到 ${result.path}`
      setTimeout(() => { runStatus.value = '' }, 3000)
    }
  } catch (e: any) {
    runStatus.value = e?.message || '导出失败'
  }
}

/* ------------------------------------------------------------------ */
/*  History                                                            */
/* ------------------------------------------------------------------ */

async function refreshHistory() {
  try {
    historyItems.value = await winApi.historyList(historyQuery.value)
  } catch (e) { console.error('[Dashboard] refreshHistory:', e) }
}

async function openHistory(id: string) {
  busy.value = true
  try {
    const item = await winApi.historyGet(id)
    selectedHistoryId.value = id
    selectedReport.value = item
    currentPage.value = 'report-detail'
  } catch (e) { console.error('[History] openHistory:', e) }
  busy.value = false
}

async function deleteHistory() {
  if (!selectedHistoryId.value) return
  busy.value = true
  try {
    await winApi.historyDelete(selectedHistoryId.value)
    selectedHistoryId.value = ''
    await refreshHistory()
  } catch (e) { console.error('[History] deleteHistory:', e) }
  busy.value = false
}

/* ------------------------------------------------------------------ */
/*  Today Captures                                                     */
/* ------------------------------------------------------------------ */

async function refreshDataAfterSettings() {
  await loadSettings()
  await refreshHistory()
  await refreshTodayCaptures()
}

async function refreshTodayCaptures() {
  const today = toYmd(new Date())
  try {
    const s = await winApi.schedulerStatus()
    captureCount.value = s.todayCaptureCount
    lastCaptureTimeStr.value = s.lastCaptureTime ? formatTs(s.lastCaptureTime) : '暂无'
    schedulerRunning.value = s.captureActive
    const captures = await winApi.capturesListByDate(today)
    todayCaptures.value = captures.map(c => ({
      timestamp: c.timestamp,
      ocrText: c.ocrText,
      windowTitle: c.windowTitle,
      category: c.category || ''
    })).reverse()
  } catch (e) { console.error('[Dashboard] refreshTodayCaptures:', e) }
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */



/* ------------------------------------------------------------------ */
/*  Scheduler                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                          */
/* ------------------------------------------------------------------ */

let disposeHotkey: (() => void) | null = null
let disposeCaptureDone: (() => void) | null = null
let disposeReportGenerated: (() => void) | null = null
let disposeWindowState: (() => void) | null = null

onMounted(async () => {
  await loadSettings()
  await refreshHistory()
  await refreshTodayCaptures()
  disposeHotkey = winApi.onHotkeyCapture(() => {
    if (!busy.value) void manualCapture()
  })
  disposeCaptureDone = winApi.onSchedulerCaptureDone((info) => {
    captureCount.value = info.count
    lastCaptureTimeStr.value = formatTs(info.timestamp)
    if (info.error) {
      runStatus.value = info.error
      setTimeout(() => { if (runStatus.value === info.error) runStatus.value = '' }, 5000)
    }
    void refreshTodayCaptures()
  })
  disposeReportGenerated = winApi.onSchedulerReportGenerated((info) => {
    if (info.error) {
      runStatus.value = info.error
    } else {
      runStatus.value = `已自动生成${info.reportType}`
    }
    void refreshHistory()
    setTimeout(() => { runStatus.value = '' }, 5000)
  })
  disposeWindowState = winApi.onWindowStateChanged(() => {})
})

onBeforeUnmount(() => {
  disposeHotkey?.()
  disposeCaptureDone?.()
  disposeReportGenerated?.()
  disposeWindowState?.()
})

watch(historyQuery, () => { void refreshHistory() })
</script>
