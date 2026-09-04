export function classifyFromTitle(title: string): string {
  const t = (title || '').toLowerCase()
  if (/会议|teams|zoom|meeting|腾讯会议|飞书会议|webex/.test(t)) return 'meeting'
  if (/chat|微信|钉钉|飞书.*聊|slack|message|邮件|outlook/.test(t)) return 'communication'
  if (/文档|word|excel|ppt|wps|notion|飞书文档|石墨|语雀|编辑器/.test(t)) return 'document'
  if (/浏览器|chrome|edge|firefox|brave|google|百度|知乎|csdn|github/.test(t)) return 'research'
  if (/分析|jira|confluence|数据|bi|dashboard|报表/.test(t)) return 'analysis'
  if (/运营|后台|管理|admin|cms|console/.test(t)) return 'operations'
  return 'operation'
}

export function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    operation: '操作', communication: '沟通', research: '调研',
    document: '文档', analysis: '分析', meeting: '会议', operations: '运营'
  }
  return labels[cat] || cat
}
