<template>
  <div>
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><span class="icon">&#128260;</span> 自动采集</div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>自动采集</label>
          <select v-model="schedulerAutoCapture">
            <option :value="true">启用</option>
            <option :value="false">禁用</option>
          </select>
        </div>
        <div class="field">
          <label>采集间隔（分钟）</label>
          <input v-model.number="schedulerInterval" type="number" min="5" max="120" />
        </div>
        <div class="field">
          <label>截图快捷键</label>
          <button class="hotkey-capture-btn" :class="{ recording: recordingHotkey }" @click="recordingHotkey = !recordingHotkey">
            <span v-if="recordingHotkey" style="color:var(--danger)">按下快捷键组合...</span>
            <span v-else>{{ displayHotkey(schedulerHotkey) }}</span>
          </button>
          <div v-if="recordingHotkey" style="font-size:12px;color:var(--danger);margin-top:3px;font-weight:600">按下新的快捷键组合，按 Esc 取消</div>
          <div v-else style="font-size:11px;color:var(--text-muted);margin-top:3px">点击后按下新的快捷键组合</div>
        </div>
      </div>
      <div class="grid-2" style="margin-top:10px">
        <div class="field">
          <label>自动生成报告</label>
          <select v-model="schedulerAutoReport">
            <option :value="true">启用</option>
            <option :value="false">禁用</option>
          </select>
        </div>
        <div class="field">
          <label>每日生成时间</label>
          <input v-model="schedulerReportTime" type="time" />
        </div>
      </div>
      <div class="field" style="margin-top:10px">
        <label>报告类型</label>
        <select v-model="schedulerReportType">
          <option value="日报">日报</option>
          <option value="周报">周报</option>
          <option value="月报">月报</option>
          <option value="自定义">自定义</option>
        </select>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-primary" :disabled="busy" @click="saveSchedulerSettings">保存设置</button>
        <span class="badge badge-success" v-if="schedulerStatusText">{{ schedulerStatusText }}</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><span class="icon">&#128247;</span> 捕获模式</div>
      </div>
      <div class="field">
        <label>截图模式</label>
        <select v-model="settings.captureMode">
          <option value="active_window">当前窗口（自动）</option>
          <option value="primary_screen">主屏全屏</option>
        </select>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><span class="icon">&#128564;</span> 闲置检测</div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>闲置时跳过采集</label>
          <select v-model="settings.idleDetectionEnabled">
            <option :value="true">启用</option>
            <option :value="false">禁用</option>
          </select>
        </div>
        <div class="field" v-if="settings.idleDetectionEnabled">
          <label>闲置阈值（分钟）</label>
          <input v-model.number="settings.idleThresholdMinutes" type="number" min="5" max="60" />
        </div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
        当系统空闲超过设定时间后，将自动跳过采集以节省资源
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><span class="icon">&#9881;</span> 系统设置</div>
      </div>
      <div class="field">
        <label>开机自启动</label>
        <select v-model="settings.launchAtLogin">
          <option :value="true">启用</option>
          <option :value="false">禁用</option>
        </select>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
        开机后自动启动应用并在后台运行
      </div>
    </div>

    <div class="panel">
      <div class="panel-header collapsible-header" @click="llmExpanded = !llmExpanded">
        <div class="panel-title"><span class="icon">&#129302;</span> LLM 配置</div>
        <span class="arrow" :class="{ open: llmExpanded }">&#9660;</span>
      </div>
      <div v-show="llmExpanded">
        <div class="grid-2" style="margin-top:8px">
          <div class="field">
            <label>模型入口</label>
            <select v-model="settings.provider">
              <option value="openrouter">OpenRouter</option>
              <option value="siliconflow">硅基流动</option>
              <option value="doubao">豆包 (火山引擎)</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="field">
            <label>Model</label>
            <input v-model="settings.model" placeholder="例如: gpt-4o-mini / deepseek-chat" />
          </div>
        </div>
        <div class="grid-2" style="margin-top:10px">
          <div class="field">
            <label>Base URL</label>
            <input v-model="activeBaseUrl" placeholder="API 地址" />
          </div>
          <div class="field">
            <label>API Key</label>
            <input v-model="activeApiKey" placeholder="API 密钥" type="password" />
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn btn-primary" :disabled="busy" @click="saveSettings">保存 LLM 设置</button>
          <button class="btn btn-primary" :disabled="busy || llmTestBusy" @click="testLlmApi">API 测试</button>
          <span class="badge badge-success" v-if="settingsStatus">{{ settingsStatus }}</span>
        </div>
        <div v-if="llmTestStatus" style="margin-top:8px;padding:8px 12px;border-radius:6px;font-size:13px"
          :style="{ background: llmTestOk ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)', color: llmTestOk ? '#52c41a' : '#ff4d4f' }">
          {{ llmTestStatus }}
        </div>

        <div style="margin:16px 0;border-top:1px solid var(--border)"></div>

        <div style="font-size:14px;font-weight:600;margin-bottom:8px"><span class="icon">&#128065;</span> LLM 视觉识别</div>
        <div class="grid-2">
          <div class="field">
            <label>启用视觉辅助识别</label>
            <select v-model="settings.llmVisionEnabled">
              <option :value="true">启用</option>
              <option :value="false">禁用</option>
            </select>
          </div>
          <div class="field" v-if="settings.llmVisionEnabled">
            <label>视觉模型名称</label>
            <input v-model="settings.llmVisionModel" placeholder="如 Qwen/Qwen2.5-VL-72B-Instruct" />
          </div>
        </div>
        <div style="margin-top:6px;font-size:12px;color:var(--text-muted)">
          启用后，采集时将截图发送给视觉大模型进行文字识别，效果远超本地 OCR。
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn btn-primary" :disabled="busy || visionTestBusy" @click="testLlmVision">视觉识别测试</button>
          <span v-if="visionTestBusy" style="font-size:12px;color:var(--text-muted)">正在截图并发送...</span>
        </div>
        <div v-if="visionTestStatus" style="margin-top:8px;padding:8px 12px;border-radius:6px;font-size:13px"
          :style="{ background: visionTestOk ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)', color: visionTestOk ? '#52c41a' : '#ff4d4f' }">
          {{ visionTestStatus }}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header collapsible-header" @click="dataExpanded = !dataExpanded">
        <div class="panel-title"><span class="icon">&#128451;</span> 数据管理</div>
        <span class="arrow" :class="{ open: dataExpanded }">&#9660;</span>
      </div>
      <div v-show="dataExpanded">
        <div class="row" style="margin-top:8px; gap:8px">
          <button class="btn btn-primary" @click="exportData">&#128228; 导出备份</button>
          <button class="btn btn-primary" @click="importData">&#128229; 导入备份</button>
          <button class="btn btn-danger" @click="clearData">&#128465; 清除所有数据</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header collapsible-header" @click="webdavExpanded = !webdavExpanded">
        <div class="panel-title"><span class="icon">&#9729;</span> WebDAV 云备份</div>
        <span class="arrow" :class="{ open: webdavExpanded }">&#9660;</span>
      </div>
      <div v-show="webdavExpanded">
        <div class="field">
          <label>启用云备份</label>
          <select v-model="settings.webdavEnabled">
            <option :value="true">启用</option>
            <option :value="false">禁用</option>
          </select>
        </div>
        <template v-if="settings.webdavEnabled">
          <div class="field">
            <label>服务器地址</label>
            <input v-model="settings.webdavUrl" placeholder="https://dav.example.com/dav/" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>用户名</label>
              <input v-model="settings.webdavUsername" placeholder="用户名" />
            </div>
            <div class="field">
              <label>密码</label>
              <input v-model="settings.webdavPassword" type="password" placeholder="密码" />
            </div>
          </div>
          <div class="field">
            <label>同步间隔</label>
            <select v-model.number="settings.webdavSyncInterval">
              <option :value="0">手动同步</option>
              <option :value="60">每小时</option>
              <option :value="360">每6小时</option>
              <option :value="720">每12小时</option>
              <option :value="1440">每天</option>
            </select>
          </div>
          <div class="field">
            <label>启动时自动恢复数据</label>
            <select v-model="settings.webdavSyncOnStartup">
              <option :value="true">启用</option>
              <option :value="false">禁用</option>
            </select>
          </div>
          <div class="row" style="margin-top:12px; gap:8px">
            <button class="btn btn-primary" :disabled="webdavTesting" @click="testWebdav">
              {{ webdavTesting ? '测试中...' : '测试连接' }}
            </button>
            <button class="btn btn-primary" :disabled="webdavSyncing" @click="webdavUpload">
              {{ webdavSyncing ? '同步中...' : '立即上传' }}
            </button>
            <button class="btn btn-primary" :disabled="webdavSyncing" @click="webdavDownload">
              {{ webdavSyncing ? '同步中...' : '立即下载' }}
            </button>
          </div>
          <div v-if="webdavTestResult" style="margin-top:8px;padding:8px 12px;border-radius:6px;font-size:13px"
            :style="{ background: webdavTestOk ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)', color: webdavTestOk ? '#52c41a' : '#ff4d4f' }">
            {{ webdavTestResult }}
          </div>
          <div v-if="webdavLastSync" style="margin-top:8px;font-size:12px;color:var(--text-muted)">
            上次同步：{{ webdavLastSync }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { displayHotkey } from '../utils/date'
import type { Settings } from '../vite-env'

const winApi = window.electronAPI

const props = defineProps<{
  settings: Settings
}>()

const emit = defineEmits<{
  (e: 'refresh-data'): void
}>()

const schedulerAutoCapture = ref(props.settings.autoCaptureEnabled)
const schedulerInterval = ref(props.settings.captureIntervalMinutes)
const schedulerAutoReport = ref(props.settings.autoReportEnabled)
const schedulerReportTime = ref(props.settings.autoReportTime)
const schedulerReportType = ref(props.settings.autoReportType || '日报')
const schedulerHotkey = ref(props.settings.captureHotkey || 'Ctrl+Shift+Y')
const recordingHotkey = ref(false)
const busy = ref(false)

const llmExpanded = ref(false)
const dataExpanded = ref(false)
const webdavExpanded = ref(false)

const llmTestBusy = ref(false)
const llmTestStatus = ref('')
const llmTestOk = ref(false)

const visionTestBusy = ref(false)
const visionTestStatus = ref('')
const visionTestOk = ref(false)

const webdavTesting = ref(false)
const webdavTestResult = ref('')
const webdavTestOk = ref(false)
const webdavSyncing = ref(false)
const webdavLastSync = ref('')

const schedulerStatusText = ref('')
const settingsStatus = ref('')

const activeBaseUrl = computed({
  get: () => {
    switch (props.settings.provider) {
      case 'openrouter': return props.settings.openrouterBaseUrl
      case 'siliconflow': return props.settings.siliconflowBaseUrl
      case 'doubao': return props.settings.doubaoBaseUrl
      case 'custom': return props.settings.customBaseUrl
      default: return props.settings.openrouterBaseUrl
    }
  },
  set: (v: string) => {
    switch (props.settings.provider) {
      case 'openrouter': props.settings.openrouterBaseUrl = v; break
      case 'siliconflow': props.settings.siliconflowBaseUrl = v; break
      case 'doubao': props.settings.doubaoBaseUrl = v; break
      case 'custom': props.settings.customBaseUrl = v; break
    }
  }
})

const activeApiKey = computed({
  get: () => {
    switch (props.settings.provider) {
      case 'openrouter': return props.settings.openrouterApiKey
      case 'siliconflow': return props.settings.siliconflowApiKey
      case 'doubao': return props.settings.doubaoApiKey
      case 'custom': return props.settings.customApiKey
      default: return props.settings.openrouterApiKey
    }
  },
  set: (v: string) => {
    switch (props.settings.provider) {
      case 'openrouter': props.settings.openrouterApiKey = v; break
      case 'siliconflow': props.settings.siliconflowApiKey = v; break
      case 'doubao': props.settings.doubaoApiKey = v; break
      case 'custom': props.settings.customApiKey = v; break
    }
  }
})

function keyCaptureHandler(e: KeyboardEvent) {
  if (!recordingHotkey.value) return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') { recordingHotkey.value = false; return }
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.metaKey) parts.push('Super')
  let key = e.code.replace('Key', '').replace('Digit', '')
  if (key === 'BracketLeft') key = '['
  else if (key === 'BracketRight') key = ']'
  else if (key === 'Backquote') key = '`'
  else if (key.length === 1) key = key.toUpperCase()
  parts.push(key)
  schedulerHotkey.value = parts.join('+')
  recordingHotkey.value = false
}

async function saveSchedulerSettings() {
  schedulerStatusText.value = ''
  busy.value = true
  try {
    await winApi.settingsSet({
      autoCaptureEnabled: schedulerAutoCapture.value,
      captureIntervalMinutes: schedulerInterval.value,
      autoReportEnabled: schedulerAutoReport.value,
      autoReportTime: schedulerReportTime.value,
      autoReportType: schedulerReportType.value,
      captureHotkey: schedulerHotkey.value
    })
    props.settings.captureIntervalMinutes = schedulerInterval.value
    props.settings.autoCaptureEnabled = schedulerAutoCapture.value
    props.settings.autoReportEnabled = schedulerAutoReport.value
    props.settings.autoReportTime = schedulerReportTime.value
    props.settings.autoReportType = schedulerReportType.value
    props.settings.captureHotkey = schedulerHotkey.value
    schedulerStatusText.value = '已保存'
    emit('refresh-data')
    setTimeout(() => { schedulerStatusText.value = '' }, 2000)
  } catch (e: any) {
    schedulerStatusText.value = e?.message || '保存失败'
  } finally {
    busy.value = false
  }
}

async function saveSettings() {
  settingsStatus.value = ''
  busy.value = true
  try {
    await winApi.settingsSet({ ...props.settings })
    settingsStatus.value = '已保存'
    emit('refresh-data')
  } catch (e: any) {
    settingsStatus.value = e?.message || '保存失败'
  } finally {
    busy.value = false
    setTimeout(() => { settingsStatus.value = '' }, 2000)
  }
}

async function testLlmApi() {
  await saveSettings()
  llmTestBusy.value = true
  llmTestStatus.value = ''
  try {
    const result = await winApi.llmTestApi({})
    llmTestOk.value = true
    llmTestStatus.value = `连接成功 — 模型回复: ${result}`
  } catch (e: any) {
    llmTestOk.value = false
    llmTestStatus.value = e?.message || '测试失败'
  } finally {
    llmTestBusy.value = false
  }
}

async function testLlmVision() {
  await saveSettings()
  visionTestBusy.value = true
  visionTestStatus.value = ''
  try {
    const result = await winApi.llmTestVision({})
    visionTestOk.value = true
    visionTestStatus.value = `视觉识别成功 — ${result}`
  } catch (e: any) {
    visionTestOk.value = false
    visionTestStatus.value = e?.message || '测试失败'
  } finally {
    visionTestBusy.value = false
  }
}

async function exportData() {
  try {
    const result = await winApi.dataExport()
    if (result.saved) {
      settingsStatus.value = '备份已导出'
      setTimeout(() => { settingsStatus.value = '' }, 3000)
    }
  } catch (e: any) {
    settingsStatus.value = e?.message || '导出失败'
  }
}

async function importData() {
  if (!confirm('导入会覆盖相同 ID 的数据，确定继续？')) return
  try {
    const result = await winApi.dataImport()
    if (result.imported) {
      settingsStatus.value = '数据导入成功'
      emit('refresh-data')
      setTimeout(() => { settingsStatus.value = '' }, 3000)
    }
  } catch (e: any) {
    settingsStatus.value = e?.message || '导入失败'
  }
}

async function clearData() {
  if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) return
  try {
    await winApi.dataClear()
    emit('refresh-data')
    settingsStatus.value = '所有数据已清除'
    setTimeout(() => { settingsStatus.value = '' }, 3000)
  } catch (e: any) {
    settingsStatus.value = e?.message || '清除失败'
  }
}

async function testWebdav() {
    await saveSettings();
    if (!props.settings.webdavUrl || !props.settings.webdavUsername || !props.settings.webdavPassword) {
        webdavTestResult.value = '请先填写服务器地址、用户名和密码'
        webdavTestOk.value = false
        return
    }
    webdavTesting.value = true
    webdavTestResult.value = ''
  try {
    const result = await winApi.webdavTest(props.settings.webdavUrl, props.settings.webdavUsername, props.settings.webdavPassword)
    webdavTestResult.value = result.message
    webdavTestOk.value = result.ok
  } catch (e: any) {
    webdavTestResult.value = `测试失败：${e?.message || '未知错误'}`
    webdavTestOk.value = false
  } finally {
    webdavTesting.value = false
  }
}

async function webdavUpload() {
  webdavSyncing.value = true
  webdavTestResult.value = ''
  try {
    const result = await winApi.webdavSyncUp()
    webdavTestResult.value = result.message
    webdavTestOk.value = result.ok
    if (result.ok && result.timestamp) {
      webdavLastSync.value = new Date(result.timestamp).toLocaleString('zh-CN')
    }
  } catch (e: any) {
    webdavTestResult.value = `上传失败：${e?.message || '未知错误'}`
    webdavTestOk.value = false
  } finally {
    webdavSyncing.value = false
  }
}

async function webdavDownload() {
  if (!confirm('从云端下载将覆盖本地数据，确定继续？')) return
  webdavSyncing.value = true
  webdavTestResult.value = ''
  try {
    const result = await winApi.webdavSyncDown()
    webdavTestResult.value = result.message
    webdavTestOk.value = result.ok
    if (result.ok) {
      emit('refresh-data')
    }
  } catch (e: any) {
    webdavTestResult.value = `下载失败：${e?.message || '未知错误'}`
    webdavTestOk.value = false
  } finally {
    webdavSyncing.value = false
  }
}

watch(() => ({ ...props.settings }), () => {}, { deep: true })

onMounted(async () => {
  document.addEventListener('keydown', keyCaptureHandler)
  if (props.settings.webdavEnabled && props.settings.webdavUrl) {
    try {
      const st = await winApi.webdavStatus()
      if (st.lastSyncTime) webdavLastSync.value = new Date(st.lastSyncTime).toLocaleString('zh-CN')
    } catch {}
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', keyCaptureHandler)
})
</script>
