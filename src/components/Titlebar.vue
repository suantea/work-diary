<template>
  <div class="titlebar">
    <div class="titlebar-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      <span>asuan工作助手</span>
    </div>
    <div class="titlebar-status">
      <span class="status-dot" :class="running ? 'running' : 'stopped'"></span>
      <span>{{ running ? '自动采集中' : '已停止' }}</span>
      <span v-if="count > 0">&middot; 今日 {{ count }} 条</span>
    </div>
    <div class="titlebar-controls">
      <button @click="winApi.minimize()" title="最小化">&#8211;</button>
      <button @click="winApi.maximize()" title="最大化">&#9633;</button>
      <button class="close-btn" @click="winApi.close()" title="最小化到托盘">&#10005;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ running: boolean; count: number }>()
const winApi = window.electronAPI
</script>
