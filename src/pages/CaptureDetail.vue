<template>
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title">
        <span class="icon">&#128197;</span> 今日采集记录（{{ captures.length }} 条）
      </div>
      <button class="btn btn-sm btn-ghost" @click="$emit('back')">&#8592; 返回</button>
    </div>
    <div v-if="captures.length > 0" class="timeline">
      <div v-for="(c, i) in captures" :key="i" class="timeline-item">
        <div class="timeline-time">{{ formatTime(c.timestamp) }}</div>
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">{{ c.windowTitle }}</div>
          <div class="timeline-preview">{{ c.ocrText.slice(0, 200) }}...</div>
        </div>
      </div>
    </div>
    <div v-else class="empty-state" style="padding:20px">
      <div class="icon">&#128196;</div>
      <div>今日暂无采集记录</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatTime } from '../utils/date'

defineProps<{ captures: { timestamp: number; windowTitle: string; ocrText: string }[] }>()
defineEmits<{ back: [] }>()
</script>
