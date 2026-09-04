<template>
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title">
        <button class="btn btn-sm btn-ghost" @click="prevDay">&#8592; 前一天</button>
        <span style="margin:0 12px;font-size:15px">{{ date }}</span>
        <button class="btn btn-sm btn-ghost" @click="nextDay">后一天 &#8594;</button>
        <button class="btn btn-sm btn-ghost" @click="goToday" style="margin-left:8px">今天</button>
      </div>
      <input v-model="search" placeholder="搜索..." style="width:200px" />
    </div>

    <div class="row" style="gap:16px;margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
      <span>记录条数：<strong style="color:var(--text)">{{ records.length }}</strong></span>
      <span>专注时长：<strong style="color:var(--text)">{{ focusHours }}h</strong></span>
      <span>活跃时段：<strong style="color:var(--text)">{{ activeRange }}</strong></span>
    </div>

    <div class="panel" v-if="categoryStats.length > 0" style="margin-bottom:16px">
      <div class="panel-header">
        <div class="panel-title">分类分布</div>
      </div>
      <div class="chart-bar" v-for="cat in categoryStats" :key="cat.name">
        <div class="chart-bar-label"><span class="category-tag" :class="'cat-' + cat.name">{{ cat.name }}</span></div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" :style="{ width: cat.pct + '%' }"></div>
        </div>
        <div class="chart-bar-value">{{ cat.count }}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">时间线记录</div>
      </div>
      <div v-if="filteredRecords.length > 0" class="timeline">
        <div v-for="(r, i) in filteredRecords" :key="i" class="timeline-item">
          <div class="timeline-time">{{ formatTime(r.timestamp) }}</div>
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-title">{{ r.windowTitle }}</div>
            <div class="timeline-preview">{{ r.ocrText.slice(0, 120) }}...</div>
            <span class="category-tag" :class="'cat-' + r.category" v-if="r.category">{{ r.categoryLabel }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state" style="padding:20px">
        <div class="icon">&#128197;</div>
        <div>该日期暂无记录</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toYmd, formatTime } from '../utils/date'
import { classifyFromTitle, getCategoryLabel } from '../utils/categories'

const winApi = window.electronAPI

const date = ref(toYmd(new Date()))
const search = ref('')
const records = ref<{ timestamp: number; ocrText: string; windowTitle: string; category: string; categoryLabel: string }[]>([])
const focusHours = ref('0')
const activeRange = ref('-')
const categoryStats = ref<{ name: string; count: number; pct: number }[]>([])

const filteredRecords = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return records.value
  return records.value.filter(r =>
    r.windowTitle.toLowerCase().includes(q) ||
    r.ocrText.toLowerCase().includes(q) ||
    r.categoryLabel.toLowerCase().includes(q)
  )
})

function prevDay() {
  const d = new Date(date.value)
  d.setDate(d.getDate() - 1)
  date.value = toYmd(d)
  refresh()
}

function nextDay() {
  const d = new Date(date.value)
  d.setDate(d.getDate() + 1)
  date.value = toYmd(d)
  refresh()
}

function goToday() {
  date.value = toYmd(new Date())
  refresh()
}

async function refresh() {
  try {
    const captures = await winApi.capturesListByDate(date.value)
    records.value = captures.map((c: any) => {
      const cat = c.category || classifyFromTitle(c.windowTitle)
      return {
        timestamp: c.timestamp,
        ocrText: c.ocrText,
        windowTitle: c.windowTitle,
        category: cat,
        categoryLabel: getCategoryLabel(cat)
      }
    })
    if (captures.length > 1) {
      const first = captures[0].timestamp
      const last = captures[captures.length - 1].timestamp
      focusHours.value = ((last - first) / 3600000).toFixed(1)
      activeRange.value = `${formatTime(first)} - ${formatTime(last)}`
    } else {
      focusHours.value = '0'
      activeRange.value = '-'
    }
    const catMap = new Map<string, number>()
    captures.forEach((c: any) => {
      const cat = c.category || classifyFromTitle(c.windowTitle)
      catMap.set(cat, (catMap.get(cat) || 0) + 1)
    })
    const total = captures.length || 1
    categoryStats.value = Array.from(catMap.entries())
      .map(([name, count]) => ({ name: getCategoryLabel(name), count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
  } catch (e) { console.error('[Timeline] refresh:', e)
    records.value = []
  }
}

watch(date, () => refresh(), { immediate: true })
</script>
