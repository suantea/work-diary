<template>
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title"><span class="icon">&#128218;</span> 历史记录 <span class="badge badge-info" v-if="items.length > 0" style="margin-left:8px">{{ items.length }}</span></div>
      <div class="row" style="gap:6px">
        <button class="btn btn-sm btn-danger" :disabled="!selectedId" @click="$emit('delete')">删除</button>
      </div>
    </div>
    <div class="field" style="margin-bottom:12px">
      <div style="position:relative">
        <input v-model="query" placeholder="搜索：类型 / 日期 / 窗口标题..." style="padding-right:32px" />
        <button v-if="query" @click="query = ''" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:4px" title="清除搜索">&#10005;</button>
      </div>
    </div>
    <div style="display:grid;gap:6px">
      <button
        v-for="h in items"
        :key="h.id"
        class="history-card"
        :class="{ selected: selectedId === h.id }"
        @click="$emit('open', h.id)"
      >
        <div class="history-card-header">
          <span class="history-card-title">{{ h.reportType }}（{{ h.startDate }} ~ {{ h.endDate }}）</span>
          <span class="history-card-time">{{ formatTs(h.createdAt) }}</span>
        </div>
        <div class="history-card-preview" :title="h.windowTitle || h.reportPreview">{{ h.windowTitle || h.reportPreview }}</div>
      </button>
      <div v-if="items.length === 0" class="empty-state">
        <div class="icon">&#128218;</div>
        <div>暂无历史记录</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatTs } from '../utils/date'
import type { HistoryListItem } from '../vite-env'

defineProps<{ items: HistoryListItem[]; selectedId: string }>()
const emit = defineEmits<{ open: [id: string]; delete: []; 'update:selectedId': [id: string] }>()
const query = defineModel<string>('query', { default: '' })
</script>
