/**
 * 七大工作分类定义
 * asuan 工作助手 分类体系
 */

export interface WorkCategory {
  id: string
  label: string
  color: string
  cssClass: string
}

export const WORK_CATEGORIES: WorkCategory[] = [
  { id: 'operation',    label: '操作', color: '#4CAF50', cssClass: 'cat-operation' },
  { id: 'communication', label: '沟通', color: '#2196F3', cssClass: 'cat-communication' },
  { id: 'research',     label: '调研', color: '#9C27B0', cssClass: 'cat-research' },
  { id: 'operations',   label: '运营', color: '#FF9800', cssClass: 'cat-operations' },
  { id: 'document',     label: '文档', color: '#009688', cssClass: 'cat-document' },
  { id: 'analysis',     label: '分析', color: '#F44336', cssClass: 'cat-analysis' },
  { id: 'meeting',      label: '会议', color: '#673AB7', cssClass: 'cat-meeting' }
]

export function getCategoryById(id: string): WorkCategory | undefined {
  return WORK_CATEGORIES.find(c => c.id === id)
}

export function getCategoryLabel(id: string): string {
  return getCategoryById(id)?.label || id
}

export function getCategoryCssClass(id: string): string {
  return getCategoryById(id)?.cssClass || ''
}

/**
 * 基于窗口标题和 OCR 文本的简单分类规则
 * 在没有 LLM 时作为 fallback 分类
 */
export function classifyFromText(windowTitle: string, _ocrText: string): string {
  const t = (windowTitle || '').toLowerCase()

  // 会议类
  if (/会议|teams|zoom|meeting|腾讯会议|飞书会议|webex/.test(t)) return 'meeting'

  // 沟通类
  if (/chat|微信|钉钉|飞书.*聊|slack|message|邮件|outlook/.test(t)) return 'communication'

  // 文档类
  if (/文档|word|excel|ppt|wps|notion|飞书文档|石墨|语雀|编辑器/.test(t)) return 'document'

  // 调研类
  if (/浏览器|chrome|edge|firefox|brave|google|百度|知乎|csdn|github/.test(t)) return 'research'

  // 分析类
  if (/分析|jira|confluence|数据|bi|dashboard|报表/.test(t)) return 'analysis'

  // 运营类
  if (/运营|后台|管理|admin|cms|console/.test(t)) return 'operations'

  // 默认：操作类（代码、工具等）
  return 'operation'
}
