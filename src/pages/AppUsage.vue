<template>
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title"><span class="icon">&#128187;</span> 应用使用记录</div>
    </div>

    <div class="tab-nav">
      <button class="tab-nav-item" :class="{ active: dimension === 'today' }" @click="dimension = 'today'">今日</button>
      <button class="tab-nav-item" :class="{ active: dimension === 'week' }" @click="dimension = 'week'">本周</button>
      <button class="tab-nav-item" :class="{ active: dimension === 'month' }" @click="dimension = 'month'">本月</button>
    </div>

    <div class="dashboard-grid" style="margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-icon blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ summary.totalApps }}</div>
          <div class="stat-label">总应用数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ summary.totalHours }}</div>
          <div class="stat-label">总时长(h)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ summary.dailyAvg }}</div>
          <div class="stat-label">日均(h)</div>
        </div>
      </div>
    </div>

    <div v-if="stats.length > 0" class="panel" style="margin-bottom:16px">
      <div class="panel-header">
        <div class="panel-title">Top 10 使用频率</div>
      </div>
      <div class="chart-bar" v-for="(s, i) in stats.slice(0, 10)" :key="i">
        <div class="chart-bar-label">{{ s.windowTitle }}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" :style="{ width: s.percentage + '%' }"></div>
        </div>
        <div class="chart-bar-value">{{ s.percentage }}%</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">详细表格</div>
      </div>
      <div style="overflow-x:auto" v-if="stats.length > 0">
        <table class="data-table">
          <thead>
            <tr><th>应用</th><th>次数</th><th>占比</th><th>首次</th><th>最近</th></tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in stats" :key="i">
              <td>{{ s.windowTitle }}</td>
              <td>{{ s.count }}</td>
              <td style="font-weight:600;color:var(--primary)">{{ s.percentage }}%</td>
              <td style="color:var(--text-secondary)">{{ s.firstTime || '-' }}</td>
              <td style="color:var(--text-secondary)">{{ s.lastTime || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state" style="padding:32px">
        <div class="icon">&#128187;</div>
        <div>暂无应用使用数据</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { toYmd } from '../utils/date'

const winApi = window.electronAPI

const dimension = ref<'today' | 'week' | 'month'>('today')
const summary = reactive({ totalApps: 0, totalHours: '0', dailyAvg: '0' })
const stats = ref<{ windowTitle: string; count: number; percentage: number; firstTime: string; lastTime: string }[]>([])

async function refresh() {
  const today = toYmd(new Date())
  let startDate = today
  const now = new Date()
  if (dimension.value === 'week') {
    const ws = new Date(now)
    const day = now.getDay()
    ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    startDate = toYmd(ws)
  } else if (dimension.value === 'month') {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  try {
    const data = await winApi.statsWindowUsage(startDate, today)
    stats.value = data.map((s: any) => ({ windowTitle: s.windowTitle, count: s.count, percentage: s.percentage, firstTime: s.firstTime || '-', lastTime: s.lastTime || '-' }))
    summary.totalApps = data.length
    const total = data.reduce((sum: number, s: any) => sum + s.count, 0)
    const hours = ((total * 30) / 60).toFixed(1)
    summary.totalHours = hours
    const days = dimension.value === 'today' ? 1 : dimension.value === 'week' ? 7 : 30
    summary.dailyAvg = (parseFloat(hours) / days).toFixed(1)
  } catch (e) { console.error('[AppUsage] refresh:', e)
    stats.value = []
  }
}

watch(dimension, () => refresh(), { immediate: true })
</script>
