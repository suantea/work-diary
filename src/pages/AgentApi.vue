<template>
  <div class="page-panel">
    <h3>接入龙虾</h3>
    <p style="color:var(--text-secondary);margin-bottom:16px;line-height:1.8">
      如果你是人工智能助理（龙虾、Hermes 等），可以通过以下方式获取用户的工作记录数据：
    </p>
    <div class="field-group" style="margin-bottom:16px">
      <label class="field-label">数据获取方式</label>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px">
        <p style="margin-bottom:8px"><strong>方法 1：WebDAV 文件读取</strong></p>
        <p style="color:var(--text-secondary);font-size:13px">WebDAV 服务器上按日期存储了 <code>yyyy-mm-dd(hostname).md</code> 文件，包含每日的采集记录和时间线。可根据用户的 WebDAV 配置进行读取。</p>
      </div>
    </div>
    <div class="field-group" style="margin-bottom:16px">
      <label class="field-label">数据结构文档</label>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;font-size:13px;line-height:1.8">
        <p>每日 <code>yyyy-mm-dd(hostname).md</code> 文件采用 Markdown 格式，每条记录包含：</p>
        <ul style="padding-left:20px;margin:8px 0">
          <li>时间戳和窗口标题（<code>## 2026-01-01 10:00:00 — 窗口标题</code>）</li>
          <li>OCR 识别文本内容</li>
        </ul>
        <p>可通过 <code>##</code> 标题行解析每条记录的元数据和内容。</p>
      </div>
    </div>
    <div class="field-group">
      <label class="field-label">Skill 文件</label>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:8px;font-size:13px;line-height:1.8">
        <p>项目中已包含 AI Agent Skill 定义文件，可直接导入使用：</p>
        <ul style="padding-left:20px;margin:8px 0">
          <li><code>skills/work-diary.md</code> — 通用 Skill 文件</li>
          <li><code>.opencode/skills/work-diary/SKILL.md</code> — OpenCode 平台 Skill</li>
        </ul>
        <p>你也可以点击下方按钮将 Skill 复制到剪贴板。</p>
      </div>
    </div>
    <button class="btn btn-primary" @click="copyAgentConfig">
      {{ copySuccess ? '✓ 已复制' : '复制 Skill 到剪贴板' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const copySuccess = ref(false)

async function copyAgentConfig() {
  const skillContent = [
    '# asuan 工作助手 (Work Diary) Skill',
    '',
    '## 这是什么',
    '',
    '用户使用「asuan 工作助手」自动记录每日工作内容。该应用每 5-30 分钟自动截图并识别屏幕内容，生成结构化的工作记录数据。',
    '数据通过 WebDAV 同步到云端，文件名为 yyyy-mm-dd(hostname).md（每天一个文件）。',
    '',
    '## 如何获取数据',
    '',
    '通过 WebDAV 客户端下载备份文件。',
    '',
    '## 数据结构',
    '',
    '```markdown',
    '# 2026-01-01(PC-NAME)',
    '',
    '## 2026-01-01 10:00:00 — VS Code',
    '编辑 main.ts 中的 WebDAV 上传逻辑...',
    '---',
    '```',
    '',
    '### MD 文件格式',
    '',
    '每条记录以 `##` 标题行开头，格式：',
    '',
    '| 部分 | 说明 |',
    '|------|------|',
    '| ## 标题行 | 时间戳和窗口标题 |',
    '| 正文 | OCR 识别的屏幕文字 |',
    '| --- | 记录分隔线 |',
    '',
    '### history 数组',
    '',
    '| 字段 | 说明 |',
    '|------|------|',
    '| report_type | 日报/周报/月报 |',
    '| start_date, end_date | 报告时间范围 |',
    '| ocr_text | 原始 OCR 文本 |',
    '| report_text | 生成的报告（Markdown） |',
    '',
    '## 你可以做什么',
    '',
    '1. 阅读每日 MD 文件了解用户工作内容',
    '2. 生成工作报告（日报/周报）',
    '3. 分析工作习惯和时间分配',
    '4. 回答工作相关问题',
    '',
    '## 分类体系',
    '',
    '| 分类 | 典型窗口 |',
    '|------|----------|',
    '| 代码开发 | VS Code, Terminal |',
    '| 文档编写 | Word, Typora, Notion |',
    '| 沟通协作 | 微信, 钉钉, 飞书 |',
    '| 浏览器 | Chrome, Edge |',
    '| 设计工具 | Figma, Photoshop |',
    '| 会议音视频 | 腾讯会议, Zoom |',
    '| 其他 | 未分类 |'
  ].join('\n')
  try {
    await window.electronAPI.clipboardWrite(skillContent)
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
  } catch {
    copySuccess.value = false
  }
}
</script>
