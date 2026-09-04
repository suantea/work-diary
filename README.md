<p align="center">
  <img src="icon.svg" width="128" height="128" alt="asuan 工作助手">
</p>

<h1 align="center">asuan 工作助手</h1>

<p align="center">
  <em>自动记录每日工作内容，生成结构化工作报告</em>
</p>

<p align="center">
  <a href="https://github.com/suantea/work-diary/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
  </a>
  <a href="https://github.com/suantea/work-diary/releases">
    <img src="https://img.shields.io/github/v/release/suantea/work-diary" alt="Release">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows-blue" alt="Platform">
  <a href="https://github.com/sponsors/suantea">
    <img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-ff69b4" alt="Sponsor">
  </a>
</p>

<p align="center">
  <a href="#功能">功能</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#开发">开发</a> •
  <a href="#隐私说明">隐私说明</a>
</p>

自动采集屏幕活动、OCR 识别屏幕文字、AI 生成日报/周报/月报的 Windows 桌面工具。无需手动记录，让工作汇报变得简单。

## 功能

| 类别 | 功能 | 说明 |
|------|------|------|
| 采集 | 自动定时截图 | 每 5-30 分钟自动截图并 OCR 识别 |
| 采集 | 热键采集 | `Ctrl+Shift+Y` 随时手动采集当前屏幕 |
| 采集 | OCR 文字识别 | 原生 Windows OCR，离线运行 |
| 采集 | LLM 视觉识别 | 可选替代 OCR，识别代码/文档/对话 |
| 报告 | AI 生成 | 一键生成日报/周报/月报 |
| 报告 | 多模型支持 | OpenRouter / SiliconFlow / Doubao / 自定义 API |
| 报告 | 历史管理 | 查看、导出 Markdown / PNG |
| 可视化 | 时间线 | 按时间轴浏览采集记录 |
| 可视化 | 热力图 | 每日工作量分布 |
| 可视化 | 应用统计 | 各应用/窗口使用时长统计 |
| 数据 | WebDAV 同步 | 备份到 WebDAV 服务器，多设备同步 |
| 数据 | Agent API | 开放 MCP / OpenAPI 协议，AI 助手可读取工作记录 |
| 体验 | 托盘驻留 | 关闭窗口后后台持续采集 |
| 体验 | 全局快捷键 | 窗口控制、采集快捷键自定义 |

## 快速开始

### 下载

从 [Releases](https://github.com/suantea/work-diary/releases) 下载最新安装包。

### 自行构建

```bash
git clone https://github.com/suantea/work-diary.git
cd work-diary
npm install
npm run dev   # 开发模式
npm run dist  # 打包安装包
```

### 首次使用

1. 启动后进入设置页面
2. 配置 LLM API（推荐 OpenRouter）
3. 开启自动采集（默认每 30 分钟一次）
4. 到仪表盘查看采集数据
5. 点击「生成报告」→ 选择日期范围 → 一键生成

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | Electron 32 + Node.js |
| 数据库 | SQLite (better-sqlite3) |
| OCR | Windows OCR (WinRT) / LLM Vision |
| LLM | OpenRouter / SiliconFlow / Doubao / 自定义 |
| 同步 | WebDAV |
| 样式 | 原生 CSS（无框架依赖） |

## 目录结构

```
electron/
  main.ts              # 主进程入口
  preload.ts           # IPC 桥接
  services/            # 核心服务（LLM、OCR、数据库等）
  ipc/                 # IPC 处理模块
src/
  App.vue              # 根组件
  components/          # 通用组件（Titlebar、Sidebar）
  pages/               # 页面组件（Dashboard、Settings 等）
  utils/               # 工具函数
  style.css            # 全局样式
```

## 开发

```bash
npm run typecheck  # 类型检查
npm run build      # 构建
npm run pack       # 打包目录
npm run dist       # 打包安装包
```

## 隐私说明

采集的截图仅在内存中完成 OCR 识别后被删除，不会持久保存截图文件。仅保存识别后的文本内容到本地 SQLite 数据库。

**注意**：OCR 文本可能包含你在屏幕上浏览的任何内容（API 密钥、密码、内部文档等）。导出备份文件时请谨慎处理。

## 许可证

[MIT](LICENSE) © 2026 suantea
