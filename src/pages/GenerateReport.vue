<template>
  <div class="generate-layout">
    <div class="tab-nav">
      <button class="tab-nav-item" :class="{ active: reportType === '日报' }" @click="reportType = '日报'">日报</button>
      <button class="tab-nav-item" :class="{ active: reportType === '周报' }" @click="reportType = '周报'">周报</button>
      <button class="tab-nav-item" :class="{ active: reportType === '月报' }" @click="reportType = '月报'">月报</button>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><span class="icon">&#128197;</span> 日期范围</div>
      </div>
      <div class="row" style="gap:6px;margin-bottom:12px">
        <button class="btn btn-sm btn-ghost" @click="setRange('today')">今天</button>
        <button class="btn btn-sm btn-ghost" @click="setRange('yesterday')">昨天</button>
        <button class="btn btn-sm btn-ghost" @click="setRange('week')">本周</button>
        <button class="btn btn-sm btn-ghost" @click="setRange('month')">本月</button>
        <button class="btn btn-sm btn-ghost" @click="setRange('last3days')">近3天</button>
        <button class="btn btn-sm btn-ghost" @click="setRange('last7days')">近7天</button>
      </div>
      <div class="row" style="gap:12px">
        <div class="field" style="flex:1">
          <label>开始日期</label>
          <input type="date" v-model="startDate" />
        </div>
        <div class="field" style="flex:1">
          <label>结束日期</label>
          <input type="date" v-model="endDate" />
        </div>
      </div>
      <div class="generate-data-preview" v-if="startDate && endDate">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>选定范围内共有 <strong>{{ previewCount }}</strong> 条采集数据</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><span class="icon">&#128172;</span> 自定义 Prompt（可选）</div>
      </div>
      <div class="field">
        <textarea v-model="customPrompt" rows="4" placeholder="输入自定义的报告要求，例如：重点关注代码审查和Bug修复方面的工作..."></textarea>
      </div>
    </div>

    <button class="btn btn-primary" style="width:100%;padding:12px" :disabled="generating || !startDate || !endDate" @click="generate">
      &#128640; {{ generating ? '生成中...' : '开始生成报告' }}
    </button>

    <div class="panel" v-if="output || generating">
      <div class="panel-header">
        <div class="panel-title"><span class="icon">&#128196;</span> 报告输出</div>
        <div class="row" style="gap:6px">
          <span class="streaming-indicator" v-if="generating"><span class="spinner"></span> 生成中...</span>
          <button class="btn btn-sm btn-ghost" v-if="output" @click="copy">&#128203; 复制</button>
          <button class="btn btn-sm btn-ghost" v-if="output" @click="exportReport">&#128228; 导出</button>
        </div>
      </div>
      <div class="generate-output report-output" v-html="rendered"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import { toYmd } from '../utils/date'

const winApi = window.electronAPI

const reportType = ref('日报')
const startDate = ref(toYmd(new Date()))
const endDate = ref(toYmd(new Date()))
const customPrompt = ref('')
const generating = ref(false)
const output = ref('')
const previewCount = ref(0)

const rendered = computed(() => {
  if (!output.value) return ''
  try { return marked.parse(output.value) as string } catch { return output.value }
})

function setRange(preset: string) {
  const now = new Date()
  const today = toYmd(now)
  switch (preset) {
    case 'today': startDate.value = today; endDate.value = today; break
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); startDate.value = toYmd(y); endDate.value = toYmd(y); break }
    case 'week': { const ws = new Date(now); const day = now.getDay(); ws.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); startDate.value = toYmd(ws); endDate.value = today; break }
    case 'month': { const ms = new Date(now.getFullYear(), now.getMonth(), 1); startDate.value = toYmd(ms); endDate.value = today; break }
    case 'last3days': { const d3 = new Date(now); d3.setDate(d3.getDate() - 2); startDate.value = toYmd(d3); endDate.value = today; break }
    case 'last7days': { const d7 = new Date(now); d7.setDate(d7.getDate() - 6); startDate.value = toYmd(d7); endDate.value = today; break }
  }
  updatePreview()
}

async function updatePreview() {
  if (!startDate.value || !endDate.value) { previewCount.value = 0; return }
  try {
    const all = await winApi.capturesListByRange(startDate.value, endDate.value)
    previewCount.value = all.length
  } catch { previewCount.value = 0 }
}

async function generate() {
  if (!startDate.value || !endDate.value) return
  output.value = ''
  generating.value = true
  try {
    const allCaptures = await winApi.capturesListByRange(startDate.value, endDate.value)
    if (!allCaptures.length) {
      output.value = '选定时间范围内没有采集数据，请先启用自动采集或手动采集。'
      generating.value = false
      return
    }
    const result = await winApi.schedulerGenerateReport({
      startDate: startDate.value,
      endDate: endDate.value,
      reportType: reportType.value,
      template: customPrompt.value || ''
    })
    output.value = result
  } catch (e: any) {
    output.value = `生成失败：${e?.message || '未知错误'}`
  } finally { generating.value = false }
}

async function copy() {
  if (!output.value) return
  try { await winApi.clipboardWrite(output.value); alert('已复制到剪贴板') } catch { alert('复制失败') }
}

async function exportReport() {
  if (!output.value) return
  const defaultName = `${reportType.value}_${startDate.value}.md`
  try {
    const result = await winApi.exportSaveFile(output.value, defaultName)
    if (result.saved) alert(`已导出到 ${result.path}`)
  } catch (e: any) { alert(e?.message || '导出失败') }
}

watch([startDate, endDate], () => updatePreview())
watch(reportType, () => updatePreview(), { immediate: true })
</script>
