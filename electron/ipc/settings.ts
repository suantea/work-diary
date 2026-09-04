import { app, ipcMain, net } from 'electron'
import type { IpcContext } from './context'
import { getSettings, setSettings } from '../services/settings'
import { startScheduler } from '../services/reportScheduler'
import { listDisplays, findDisplayForWindow, captureScreen, toDisplayRelative, preprocessForVision } from '../services/screenshot'
import { pickProviderCfg } from './util'

export function registerSettingsIpc(ctx: IpcContext) {
  ipcMain.handle('settings:get', async () => getSettings())
  ipcMain.handle('settings:set', async (_e, patch) => {
    const result = setSettings(patch ?? {})
    startScheduler(ctx.getWindow)
    ctx.updateTrayMenu?.()
    if (patch && 'captureHotkey' in patch) {
      ctx.registerShortcuts?.()
    }
    if (patch && 'launchAtLogin' in patch) {
      app.setLoginItemSettings({
        openAtLogin: result.launchAtLogin || false
      })
    }
    return result
  })

  // --- LLM API 连通性测试 ---
  ipcMain.handle('llm:test-api', async (_e, _params) => {
    const s = getSettings()
    const { baseUrl, apiKey } = pickProviderCfg(s)
    if (!baseUrl) throw new Error('Base URL 未配置')
    if (!apiKey) throw new Error('API Key 未配置')
    if (!s.model) throw new Error('Model 未配置')

    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: s.model,
        messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
        temperature: 0.1,
        max_tokens: 1000,
        stream: false
      })
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`API 请求失败（${res.status}）：${body.slice(0, 200)}`)
    let json: any
    try { json = JSON.parse(body) } catch { throw new Error(`API 返回非 JSON：${body.slice(0, 200)}`) }
    const msg = json?.choices?.[0]?.message
    let text = msg?.content
    // 推理模型（如 DeepSeek-R1、QwQ）把思维链放在 reasoning_content 里，实际回复可能为空
    if (!text && msg?.reasoning_content) text = msg.reasoning_content
    if (!text) throw new Error(`API 返回内容为空（model=${s.model}，finish_reason=${json?.choices?.[0]?.finish_reason}）`)
    return String(text).trim()
  })

  // --- LLM 视觉识别测试 ---
  ipcMain.handle('llm:test-vision', async (_e, _params) => {
    const s = getSettings()
    const { baseUrl, apiKey } = pickProviderCfg(s)
    if (!baseUrl) throw new Error('Base URL 未配置')
    if (!apiKey) throw new Error('API Key 未配置')
    if (!s.llmVisionModel) throw new Error('视觉模型名称未配置')

    let dataUrl: string
    try {
      const { getActiveWindowRect } = await import('../services/activeWindow')
      const windowRect = await getActiveWindowRect()
      const displays = await listDisplays()
      const display = findDisplayForWindow(displays, windowRect)
      if (!display) throw new Error('无法检测到显示器')
      console.log('[视觉测试] 显示器:', display.id)

      const buf = await captureScreen(display.id)
      const relativeRect = toDisplayRelative(windowRect, display)
      const vision = preprocessForVision(buf, relativeRect)
      dataUrl = vision.dataUrl
    } catch (err: any) {
      throw new Error(`截图失败: ${err?.message || err}`)
    }

    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: s.llmVisionModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '提取截图中的核心工作内容（代码/文档/对话/数据）。忽略UI元素和无关内容。要点式输出，每行一条。无内容则输出：无有效内容' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }],
        temperature: 0.1,
        stream: false,
        max_tokens: 512
      })
    })
    const json: any = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = json?.error?.message ? String(json.error.message) : JSON.stringify(json)
      throw new Error(`视觉识别请求失败（${res.status}）：${msg}`)
    }
    const choice = json?.choices?.[0]?.message
    let text = choice?.content
    if (!text || !text.trim()) text = choice?.reasoning_content
    if (!text || !text.trim()) throw new Error(`视觉识别返回为空（finish_reason=${json?.choices?.[0]?.finish_reason}）`)
    return String(text).trim()
  })
}
