<template>
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title"><span class="icon">&#128293;</span> 时段热力图</div>
    </div>

    <div class="row" style="gap:6px;margin-bottom:12px">
      <button class="btn btn-sm btn-ghost" @click="setRange('today')">今天</button>
      <button class="btn btn-sm btn-ghost" @click="setRange('week')">本周</button>
      <button class="btn btn-sm btn-ghost" @click="setRange('month')">本月</button>
      <button class="btn btn-sm btn-ghost" @click="setRange('last7days')">近7天</button>
      <button class="btn btn-sm btn-ghost" @click="setRange('last30days')">近30天</button>
    </div>
    <div class="row" style="gap:12px;margin-bottom:16px">
      <div class="field" style="flex:1">
        <label>开始日期</label>
        <input type="date" v-model="startDate" />
      </div>
      <div class="field" style="flex:1">
        <label>结束日期</label>
        <input type="date" v-model="endDate" />
      </div>
      <button class="btn btn-primary" style="align-self:end" :disabled="busy || !startDate || !endDate" @click="generate">
        &#128269; 生成热力图
      </button>
    </div>

    <div class="row" style="gap:20px;margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
      <span>记录条数：<strong style="color:var(--text)">{{ stats.totalRecords }}</strong></span>
      <span>专注时长：<strong style="color:var(--text)">{{ stats.focusHours }}h</strong></span>
      <span>活跃天数：<strong style="color:var(--text)">{{ stats.activeDays }}</strong></span>
      <span>日均记录：<strong style="color:var(--text)">{{ stats.dailyAvg }}</strong></span>
    </div>

    <div v-if="rows.length > 0" style="overflow-x:auto;max-width:100%">
      <div class="heatmap-legend">
        <span>少</span>
        <div class="heatmap-cell level-0"></div>
        <div class="heatmap-cell level-1"></div>
        <div class="heatmap-cell level-2"></div>
        <div class="heatmap-cell level-3"></div>
        <div class="heatmap-cell level-4"></div>
        <div class="heatmap-cell level-5"></div>
        <span>多</span>
      </div>
      <div class="heatmap-axis">
        <span v-for="h in 24" :key="h">{{ (h - 1).toString().padStart(2, '0') }}</span>
      </div>
      <div class="heatmap-grid">
        <div v-for="(row, ri) in rows" :key="ri" class="heatmap-row">
          <div class="heatmap-label">{{ row.label }}</div>
          <div class="heatmap-cells">
            <div v-for="(cell, ci) in row.cells" :key="ci" class="heatmap-cell" :class="'level-' + cell.level" :title="cell.label + ': ' + cell.count + '条记录'">{{ cell.count || '' }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-state" style="padding:32px">
      <div class="icon">&#128293;</div>
      <div>选择日期范围后点击生成热力图</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { toYmd } from '../utils/date'

const winApi = window.electronAPI

const busy = ref(false)
const startDate = ref(toYmd(new Date()))
const endDate = ref(toYmd(new Date()))
const stats = reactive({ totalRecords: 0, focusHours: '0', activeDays: 0, dailyAvg: 0 })
const rows = ref<{ label: string; cells: { count: number; level: number; label: string }[] }[]>([])

function setRange(preset: string) {
  const now = new Date()
  const today = toYmd(now)
  switch (preset) {
    case 'today':
      startDate.value = today; endDate.value = today; break
    case 'week': {
      const ws = new Date(now)
      const day = now.getDay()
      ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      startDate.value = toYmd(ws); endDate.value = today; break
    }
    case 'month': {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1)
      startDate.value = toYmd(ms); endDate.value = today; break
    }
    case 'last7days': {
      const d7 = new Date(now); d7.setDate(d7.getDate() - 6)
      startDate.value = toYmd(d7); endDate.value = today; break
    }
    case 'last30days': {
      const d30 = new Date(now); d30.setDate(d30.getDate() - 29)
      startDate.value = toYmd(d30); endDate.value = today; break
    }
  }
  generate()
}

async function generate() {
  if (!startDate.value || !endDate.value) return
  busy.value = true
  try {
    const start = new Date(startDate.value)
    const end = new Date(endDate.value)
    const allCaptures = await winApi.capturesListByRange(startDate.value, endDate.value)
    const byDate = new Map<string, any[]>()
    allCaptures.forEach((c: any) => {
      const ds = toYmd(new Date(c.timestamp))
      if (!byDate.has(ds)) byDate.set(ds, [])
      byDate.get(ds)!.push(c)
    })
    const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const d = new Date(start)
    let globalMaxCount = 1
    const hourlyData: { dateStr: string; label: string; hourCounts: number[] }[] = []
    let totalRecords = 0
    const activeDaysSet = new Set<string>()
    while (d <= end) {
      const dateStr = toYmd(d)
      const captures = byDate.get(dateStr) || []
      const hourCounts = new Array(24).fill(0)
      captures.forEach((c: any) => { hourCounts[new Date(c.timestamp).getHours()]++ })
      const dayMax = Math.max(...hourCounts, 0)
      if (dayMax > globalMaxCount) globalMaxCount = dayMax
      hourlyData.push({ dateStr, label: `${d.getMonth() + 1}/${d.getDate()} ${dayLabels[d.getDay()]}`, hourCounts })
      totalRecords += captures.length
      if (captures.length > 0) activeDaysSet.add(dateStr)
      d.setDate(d.getDate() + 1)
    }
    rows.value = hourlyData.map(hd => ({
      label: hd.label,
      cells: hd.hourCounts.map((count, h) => ({
        count, level: count > 0 ? Math.min(5, Math.ceil((count / globalMaxCount) * 5)) : 0,
        label: `${h}:00`
      }))
    })).reverse()
    stats.totalRecords = totalRecords
    stats.activeDays = activeDaysSet.size
    stats.dailyAvg = activeDaysSet.size > 0 ? Math.round(totalRecords / activeDaysSet.size) : 0
    const days = (end.getTime() - start.getTime()) / 86400000 + 1
    stats.focusHours = ((totalRecords * 30) / 60).toFixed(1)
  } catch (e) { console.error('[Heatmap] generate:', e)
    rows.value = []
  } finally { busy.value = false }
}
</script>
