<template>
  <!-- Brand Area -->
  <div class="brand-area">
    <div class="brand-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    </div>
    <div class="brand-text">
      <h2>你只管工作，日报交给我</h2>
      <div class="brand-tags">
        <div class="brand-tag">截图分析后即刻销毁</div>
        <div class="brand-tag">数据仅存本地，不上传云端</div>
        <div class="brand-tag">你的工作内容只属于你</div>
      </div>
    </div>
  </div>

  <!-- 刷新按钮 -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <button class="btn btn-sm btn-ghost" @click="refreshDashboard" :disabled="busy">
      &#128260; 刷新
    </button>
  </div>

  <!-- 状态概览卡片 -->
  <div class="dashboard-grid">
    <div class="stat-card">
      <div class="stat-icon" :class="schedulerRunning ? 'active' : 'inactive'">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ schedulerRunning ? '运行中' : '已停止' }}</div>
        <div class="stat-label">自动采集</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ captureCount }}</div>
        <div class="stat-label">今日采集</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ accumulatedCount }}</div>
        <div class="stat-label">范围内数据</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ lastCaptureTimeStr || '暂无' }}</div>
        <div class="stat-label">上次采集</div>
      </div>
    </div>
  </div>

  <!-- 采集配置概要 -->
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 自动化配置</div>
      <button class="btn btn-sm btn-ghost" @click="$emit('navigate', 'settings')">修改 &#8250;</button>
    </div>
    <div class="config-summary">
      <div class="config-row">
        <span class="config-key">采集间隔</span>
        <span class="config-val">{{ settings.captureIntervalMinutes }} 分钟</span>
      </div>
      <div class="config-row">
        <span class="config-key">报告类型</span>
        <span class="config-val">{{ settings.autoReportType || '日报' }}</span>
      </div>
      <div class="config-row">
        <span class="config-key">自动报告</span>
        <span class="config-val">{{ settings.autoReportEnabled ? settings.autoReportTime : '已关闭' }}</span>
      </div>
      <div class="config-row">
        <span class="config-key">截图模式</span>
        <span class="config-val">{{ settings.captureMode === 'primary_screen' ? '主屏全屏' : '当前窗口' }}</span>
      </div>
    </div>
  </div>

  <!-- 今日工作分类分布 -->
  <div class="panel" v-if="dashboardCategoryStats.length > 0">
    <div class="panel-header">
      <div class="panel-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> 今日工作分类</div>
    </div>
    <div class="row" style="gap:16px;flex-wrap:wrap">
      <div v-for="cat in dashboardCategoryStats" :key="cat.name" class="dashboard-cat-item">
        <span class="category-tag" :class="'cat-' + cat.name">{{ cat.label }}</span>
        <span class="dashboard-cat-count">{{ cat.count }}次</span>
        <span class="dashboard-cat-pct">{{ cat.pct }}%</span>
      </div>
    </div>
  </div>

  <!-- 今日采集时间线 -->
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> 今日采集记录</div>
      <div class="row" style="gap:6px;align-items:center">
        <span class="badge badge-info" v-if="captureCount > 0">{{ captureCount }} 条</span>
        <span class="badge badge-success" v-if="dashboardFocusHours !== '0'">{{ dashboardFocusHours }}h</span>
        <button v-if="todayCaptures.length > 5" class="btn btn-sm btn-ghost" @click="$emit('navigate', 'capture-detail')">查看全部 &#8250;</button>
      </div>
    </div>
    <div v-if="todayCaptures.length > 0" class="timeline">
      <div v-for="(c, i) in todayCaptures.slice(0, 5)" :key="i" class="timeline-item">
        <div class="timeline-time">{{ formatTime(c.timestamp) }}</div>
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">{{ c.windowTitle }}</div>
          <div class="timeline-preview">{{ c.ocrText.slice(0, 80) }}...</div>
          <span class="category-tag" :class="'cat-' + c.category" v-if="c.category">{{ getCategoryLabel(c.category) }}</span>
        </div>
      </div>
    </div>
    <div v-else class="empty-state" style="padding:20px">
      <div class="icon">&#128196;</div>
      <div>今日暂无采集记录</div>
      <div style="font-size:11px;margin-top:4px;color:var(--text-muted)">应用运行后将自动开始采集</div>
    </div>
  </div>

  <!-- 时间分配 + 最近报告 两列布局 -->
  <div class="dashboard-two-col">
  <!-- 时间分配 -->
  <div class="panel" v-if="windowUsageStats.length > 0">
    <div class="panel-header">
      <div class="panel-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 今日时间分配</div>
      <button v-if="windowUsageStats.length > 5" class="btn btn-sm btn-ghost" @click="showUsageDetail = true">查看全部 &#8250;</button>
    </div>
    <div class="usage-stats">
      <div v-for="stat in windowUsageStats.slice(0, 5)" :key="stat.windowTitle" class="usage-stat-item" @click="showUsageDetail = true" style="cursor:pointer">
        <div class="usage-stat-header">
          <span class="usage-stat-title">{{ stat.windowTitle }}</span>
          <span class="usage-stat-pct">{{ stat.percentage }}%</span>
        </div>
        <div class="usage-stat-bar">
          <div class="usage-stat-fill" :style="{ width: stat.percentage + '%' }"></div>
        </div>
        <div class="usage-stat-detail">{{ stat.count }} 次采集</div>
      </div>
    </div>
  </div>

  <!-- 时间分配详情弹窗 -->
  <div class="modal-overlay" v-if="showUsageDetail" @click.self="showUsageDetail = false">
    <div class="modal-content">
      <div class="panel-header" style="margin-bottom:12px">
        <div class="panel-title">今日时间分配详情</div>
        <button class="btn btn-sm btn-ghost" @click="showUsageDetail = false">&#10005;</button>
      </div>
      <div class="usage-stats">
        <div v-for="stat in windowUsageStats" :key="stat.windowTitle" class="usage-stat-item">
          <div class="usage-stat-header">
            <span class="usage-stat-title text-ellipsis" :title="stat.windowTitle">{{ stat.windowTitle.length > 25 ? stat.windowTitle.slice(0, 25) + '...' : stat.windowTitle }}</span>
            <span class="usage-stat-pct">{{ stat.percentage }}%</span>
          </div>
          <div class="usage-stat-bar">
            <div class="usage-stat-fill" :style="{ width: stat.percentage + '%' }"></div>
          </div>
          <div class="usage-stat-detail">{{ stat.count }} 次采集</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 最近报告 -->
  <div class="panel" v-if="recentReports.length > 0">
    <div class="panel-header">
      <div class="panel-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> 最近报告</div>
      <button class="btn btn-sm btn-ghost" @click="$emit('navigate', 'history')">查看全部 &#8250;</button>
    </div>
    <div class="report-list">
      <button
        v-for="r in recentReports.slice(0, 3)"
        :key="r.id"
        class="report-item"
        @click="$emit('openHistory', r.id)"
      >
        <div class="report-item-header">
          <span class="report-item-type">{{ r.reportType }}</span>
          <span class="report-item-date">{{ r.startDate }} ~ {{ r.endDate }}</span>
        </div>
        <div class="report-item-preview">{{ r.reportPreview }}</div>
      </button>
    </div>
  </div>
  </div>

  <!-- 手动生成报告 -->
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 手动生成报告</div>
    </div>
    <div class="row" style="gap:8px; flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:120px">
        <label>报告类型</label>
        <select v-model="manualReportType">
          <option value="日报">日报</option>
          <option value="周报">周报</option>
          <option value="月报">月报</option>
        </select>
      </div>
      <div class="field" style="flex:1;min-width:120px">
        <label>开始日期</label>
        <input type="date" v-model="manualStartDate" />
      </div>
      <div class="field" style="flex:1;min-width:120px">
        <label>结束日期</label>
        <input type="date" v-model="manualEndDate" />
      </div>
    </div>
    <button
      class="btn btn-primary"
      style="margin-top:12px;width:100%"
      :disabled="busy || !manualStartDate || !manualEndDate"
      @click="manualGenerateReport"
    >
      &#128260; {{ busy ? '生成中...' : '立即生成报告' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, reactive } from 'vue'
import { formatTime, formatTs, toYmd } from '../utils/date'
import { classifyFromTitle, getCategoryLabel } from '../utils/categories'
import type { HistoryListItem, NavPage, Settings, WindowUsageStat } from '../vite-env'

const emit = defineEmits<{
  navigate: [page: NavPage]
  openHistory: [id: string]
}>()

const winApi = window.electronAPI

const busy = ref(false)
const runStatus = ref('')
const schedulerRunning = ref(false)
const captureCount = ref(0)
const accumulatedCount = ref(0)
const lastCaptureTimeStr = ref('')

const manualReportType = ref('日报')
const manualStartDate = ref(toYmd(new Date()))
const manualEndDate = ref(toYmd(new Date()))

const todayCaptures = ref<{ timestamp: number; ocrText: string; windowTitle: string; category: string }[]>([])
const dashboardCategoryStats = ref<{ name: string; label: string; count: number; pct: number }[]>([])
const dashboardFocusHours = ref('0')
const recentReports = ref<HistoryListItem[]>([])
const windowUsageStats = ref<WindowUsageStat[]>([])
const showUsageDetail = ref(false)

const settings = reactive<Partial<Settings>>({
  captureIntervalMinutes: 30,
  autoReportType: '日报',
  autoReportEnabled: false,
  autoReportTime: '18:00',
  captureMode: 'active_window'
})

async function loadSettings() {
  const s = await winApi.settingsGet()
  settings.captureIntervalMinutes = s.captureIntervalMinutes
  settings.autoReportType = s.autoReportType || '日报'
  settings.autoReportEnabled = s.autoReportEnabled
  settings.autoReportTime = s.autoReportTime
  settings.captureMode = s.captureMode
}

async function loadRecentReports() {
  try {
    const items = await winApi.historyList('')
    recentReports.value = items.slice(0, 3)
  } catch (e) { console.error('[Dashboard] loadRecentReports:', e) }
}

async function refreshDashboard() {
  await loadSettings()
  await loadRecentReports()
  await refreshTodayCaptures()
  await updateAccumulatedCount()
  await refreshWindowUsageStats()
}

async function manualGenerateReport() {
  if (!manualStartDate.value || !manualEndDate.value) return
  runStatus.value = '正在生成报告...'
  busy.value = true
  try {
    const reportText = await winApi.schedulerGenerateReport({
      startDate: manualStartDate.value,
      endDate: manualEndDate.value,
      reportType: manualReportType.value,
      template: ''
    })
    runStatus.value = '报告生成成功！'
    await loadRecentReports()
    await winApi.reportAutoExport({
      reportType: manualReportType.value,
      startDate: manualStartDate.value,
      endDate: manualEndDate.value,
      content: reportText
    })
  } catch (e: any) {
    runStatus.value = e?.message || '生成失败'
  } finally {
    busy.value = false
    setTimeout(() => { runStatus.value = '' }, 3000)
  }
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
    refreshDashboardCategoryStats(captures)
  } catch (e) { console.error('[Dashboard] refreshTodayCaptures:', e) }
}

async function refreshWindowUsageStats() {
  const today = toYmd(new Date())
  try {
    windowUsageStats.value = await winApi.statsWindowUsage(today, today)
  } catch (e) { console.error('[Dashboard] refreshWindowUsageStats:', e) }
}

function refreshDashboardCategoryStats(captures: { timestamp: number; windowTitle: string; ocrText: string; category?: string }[]) {
  const catMap = new Map<string, number>()
  captures.forEach(c => {
    const cat = c.category || classifyFromTitle(c.windowTitle)
    catMap.set(cat, (catMap.get(cat) || 0) + 1)
  })
  const total = captures.length || 1
  dashboardCategoryStats.value = Array.from(catMap.entries())
    .map(([name, count]) => ({ name, label: getCategoryLabel(name), count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
  if (captures.length > 1) {
    const first = captures[0].timestamp
    const last = captures[captures.length - 1].timestamp
    dashboardFocusHours.value = ((last - first) / 3600000).toFixed(1)
  } else {
    dashboardFocusHours.value = '0'
  }
}

async function updateAccumulatedCount() {
  const today = toYmd(new Date())
  try {
    accumulatedCount.value = await winApi.schedulerAccumulatedCount(today, today)
  } catch (e) { console.error('[Dashboard] updateAccumulatedCount:', e); accumulatedCount.value = 0 }
}

let disposeCaptureDone: (() => void) | null = null
let disposeReportGenerated: (() => void) | null = null

onMounted(async () => {
  await loadSettings()
  await loadRecentReports()
  await refreshTodayCaptures()
  await updateAccumulatedCount()
  await refreshWindowUsageStats()

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
    void loadRecentReports()
    setTimeout(() => { runStatus.value = '' }, 5000)
  })
})

onUnmounted(() => {
  disposeCaptureDone?.()
  disposeReportGenerated?.()
})
</script>
