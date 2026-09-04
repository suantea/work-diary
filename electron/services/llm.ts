import { net } from 'electron'
import type { Settings } from './settings'

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 120_000
/** 流式读取超时（毫秒，无新数据块到达） */
const STREAM_IDLE_TIMEOUT = 60_000

export interface GenerateParams {
  reportType: string
  startDate: string
  endDate: string
  template: string
  ocrText: string
}

function fillTemplate(t: string, params: { reportType: string; startDate: string; endDate: string }) {
  return t
    .replaceAll('{报告类型}', params.reportType)
    .replaceAll('{开始日期}', params.startDate)
    .replaceAll('{结束日期}', params.endDate)
}

function pickProvider(s: Settings) {
  switch (s.provider) {
    case 'openrouter':
      return { baseUrl: s.openrouterBaseUrl, apiKey: s.openrouterApiKey }
    case 'siliconflow':
      return { baseUrl: s.siliconflowBaseUrl, apiKey: s.siliconflowApiKey }
    case 'doubao':
      return { baseUrl: s.doubaoBaseUrl, apiKey: s.doubaoApiKey }
    case 'custom':
      return { baseUrl: s.customBaseUrl, apiKey: s.customApiKey }
    default:
      return { baseUrl: s.openrouterBaseUrl, apiKey: s.openrouterApiKey }
  }
}

function buildMessages(settings: Settings, p: GenerateParams) {
  const provider = pickProvider(settings)
  if (!provider.baseUrl) throw new Error('Base URL 为空')
  if (!provider.apiKey) throw new Error('API Key 为空')
  if (!settings.model) throw new Error('Model 为空')

  const template = fillTemplate(p.template || '', {
    reportType: p.reportType,
    startDate: p.startDate,
    endDate: p.endDate
  })

  const system = [
    '你是一个专业的工作报告写作助手。',
    '你擅长从OCR识别的文本中提取有价值的工作信息，生成高质量的工作报告。',
    '',
    '## 核心原则',
    '1. **只基于事实**：只写OCR文本中明确提到的工作内容，不要编造',
    '2. **智能归纳**：将零散的OCR文本归纳为结构化的工作事项',
    '3. **量化成果**：尽量用数字、百分比等量化指标描述工作成果',
    '4. **专业表达**：使用正式、专业的工作汇报语言',
    '5. **合理推测**：对于模糊信息，可以合理推测但标注"（推测）"',
    '',
    '## 输出格式要求',
    '- 使用Markdown格式，紧凑排版，段落之间不要空行',
    '- 结构清晰，分模块列出',
    '- 每条工作事项简洁明了，一行一条，用列表形式',
    '- 段落之间不要有空行，标题与内容之间不要有空行',
    '- 不要输出多余的空行、空段落、分隔线（---）或装饰性符号',
    '- 保持紧凑：每行紧接上一行，不要为了美观添加额外间距'
  ].join('\n')

  const user = [
    `## 报告信息`,
    `- **报告类型**：${p.reportType}`,
    `- **时间范围**：${p.startDate} ~ ${p.endDate}`,
    '',
    `## 输出要求`,
    template || '(使用默认格式)',
    '',
    `## OCR识别文本`,
    '```',
    p.ocrText || '(无内容)',
    '```',
    '',
    '请根据以上OCR文本，按照输出要求生成工作报告。'
  ].join('\n')

  return {
    url: provider.baseUrl.replace(/\/+$/, '') + '/chat/completions',
    apiKey: provider.apiKey,
    model: settings.model,
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user }
    ]
  }
}

/** 后处理：清理报告中多余的空行（保留代码块内空行） */
function cleanReport(text: string): string {
  const lines = text.split('\n')
  let inCodeBlock = false
  const result = lines.filter(l => {
    if (l.trimStart().startsWith('```')) inCodeBlock = !inCodeBlock
    return inCodeBlock || l.trim() !== ''
  })
  return result.join('\n').trim()
}

/**
 * 带超时和重试的 fetch
 * - 超时：`REQUEST_TIMEOUT` 毫秒后 Abort
 * - 重试触发条件：网络错误 / 5xx / 429 / 超时
 * - 退避策略：1s → 3s → 9s（指数退避）
 */
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    try {
      const res = await net.fetch(url, { ...init, signal: controller.signal })
      if (res.ok || (res.status < 500 && res.status !== 429)) return res
      const retryAfter = res.headers.get('Retry-After')
      const waitSec = retryAfter ? Math.min(Number(retryAfter), 30) : Math.min(3 ** attempt, 30)
      console.log(`[LLM] 请求失败 ${res.status}，${waitSec}s 后重试 (${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, waitSec * 1000))
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log(`[LLM] 请求超时 (${REQUEST_TIMEOUT}ms)，第${attempt + 1}次`)
      } else {
        console.log(`[LLM] 网络错误: ${err?.message}，第${attempt + 1}次`)
      }
      if (attempt >= maxRetries) throw new Error(err?.name === 'AbortError' ? '请求超时，请检查网络或 API 服务状态' : `网络错误：${err?.message}`)
      const waitSec = Math.min(3 ** attempt, 30)
      console.log(`[LLM] ${waitSec}s 后重试`)
      await new Promise(r => setTimeout(r, waitSec * 1000))
    } finally {
      clearTimeout(timeoutId)
    }
  }
  throw new Error('重试次数用尽')
}

/**
 * 非流式生成（兼容旧逻辑）
 */
export async function generateReport(settings: Settings, p: GenerateParams): Promise<string> {
  const { url, apiKey, model, messages } = buildMessages(settings, p)

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, stream: false, max_tokens: 4096 })
  })

  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error?.message ? String(json.error.message) : JSON.stringify(json)
    throw new Error(`LLM 请求失败（${res.status}）：${msg}`)
  }

  const choice = json?.choices?.[0]?.message
  let text = choice?.content
  if (!text || !text.trim()) text = choice?.reasoning_content
  if (!text || !text.trim()) throw new Error(`LLM 返回为空（finish_reason=${json?.choices?.[0]?.finish_reason}）`)
  return cleanReport(String(text))
}

/**
 * 流式生成 — 每收到一个 token 就回调
 * 返回完整文本
 */
export async function generateReportStream(
  settings: Settings,
  p: GenerateParams,
  onChunk: (chunk: string) => void
): Promise<string> {
  const { url, apiKey, model, messages } = buildMessages(settings, p)

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, stream: true, max_tokens: 4096 })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LLM 请求失败（${res.status}）：${text.slice(0, 200)}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法获取响应流')

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''
  let lastChunkTime = Date.now()

  while (true) {
    if (Date.now() - lastChunkTime > STREAM_IDLE_TIMEOUT) {
      throw new Error(`流式响应超时（${STREAM_IDLE_TIMEOUT / 1000}s 无新数据）`)
    }
    const { done, value } = await reader.read()
    if (done) break
    lastChunkTime = Date.now()

    buffer += decoder.decode(value, { stream: true })

    // 解析 SSE 格式
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // 保留未完成的行

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue

      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          onChunk(delta)
        }
      } catch {
        // 跳过解析失败的行
      }
    }
  }

  return cleanReport(fullText)
}

/**
 * AI 辅助 OCR 文本清洗：修正 OCR 识别错误，提高准确度
 */
/**
 * LLM 视觉识别：将截图发送给视觉大模型，直接返回识别到的文字内容
 * @param imageDataUrl data:image/xxx;base64,... 格式的完整 data URL
 */
export async function llmVisionRecognize(
  settings: Settings,
  imageDataUrl: string
): Promise<string> {
  const provider = pickProvider(settings)
  if (!provider.baseUrl || !provider.apiKey) throw new Error('LLM API 未配置')
  const visionModel = settings.llmVisionModel || settings.model
  if (!visionModel) throw new Error('视觉模型名称未配置')

  const url = provider.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '提取截图中的核心工作内容（代码/文档/对话/数据）。忽略UI元素和无关内容。要点式输出，每行一条。无内容则输出：无有效内容' },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }],
      stream: false,
      max_tokens: 512,
      temperature: 0.1
    })
  })

  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error?.message ? String(json.error.message) : JSON.stringify(json)
    throw new Error(`LLM 视觉识别失败（${res.status}）：${msg}`)
  }

  const choice = json?.choices?.[0]?.message
  let text = choice?.content
  if (!text || !text.trim()) text = choice?.reasoning_content
  if (!text || !text.trim()) throw new Error(`LLM 视觉识别返回为空（finish_reason=${json?.choices?.[0]?.finish_reason}）`)
  return String(text).trim()
}
