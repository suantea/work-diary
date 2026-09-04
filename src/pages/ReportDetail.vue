<template>
  <div class="page-panel" v-if="report">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h3>{{ report.reportType }}</h3>
        <span style="font-size:12px;color:var(--text-muted)">
          {{ report.startDate }} ~ {{ report.endDate }}
          <span v-if="report.createdAt"> · {{ new Date(report.createdAt).toLocaleString('zh-CN') }}</span>
        </span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-ghost" @click="$emit('back')">&#8249; 返回</button>
        <button class="btn btn-sm" @click="$emit('copy')">复制</button>
        <button class="btn btn-sm" @click="$emit('export')">导出</button>
        <button class="btn btn-sm btn-danger" @click="$emit('delete')">删除</button>
      </div>
    </div>
    <div class="report-content" v-html="rendered"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { HistoryItem } from '../vite-env'

const props = defineProps<{ report: HistoryItem | null }>()
defineEmits<{ back: []; copy: []; export: []; delete: [] }>()

const rendered = computed(() => {
  if (!props.report?.reportText) return ''
  try {
    return marked.parse(props.report.reportText) as string
  } catch {
    return props.report.reportText
  }
})
</script>
