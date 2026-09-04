import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbDir = app.getPath('userData')
  mkdirSync(dbDir, { recursive: true })
  const dbPath = path.join(dbDir, 'data.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 初始化表结构
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      report_type TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      window_title TEXT NOT NULL DEFAULT '',
      ocr_preview TEXT NOT NULL DEFAULT '',
      report_preview TEXT NOT NULL DEFAULT '',
      ocr_text TEXT NOT NULL DEFAULT '',
      report_text TEXT NOT NULL DEFAULT '',
      template TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);

    CREATE TABLE IF NOT EXISTS captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      ocr_text TEXT NOT NULL DEFAULT '',
      window_title TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      duration REAL NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_captures_date ON captures(date);
    CREATE INDEX IF NOT EXISTS idx_captures_date_ts ON captures(date, timestamp);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      report_type TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(report_type);

    CREATE TABLE IF NOT EXISTS app_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      app_name TEXT NOT NULL,
      total_duration REAL NOT NULL DEFAULT 0,
      first_used INTEGER,
      last_used INTEGER,
      usage_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_app_stats_date ON app_stats(date);

    CREATE TABLE IF NOT EXISTS work_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      app_name TEXT NOT NULL DEFAULT '',
      window_title TEXT NOT NULL DEFAULT '',
      duration REAL NOT NULL DEFAULT 0,
      display_id INTEGER NOT NULL DEFAULT 0,
      is_private INTEGER NOT NULL DEFAULT 0,
      raw_text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_work_records_timestamp ON work_records(timestamp DESC);
  `)

  // 迁移：为 captures 表添加 category 和 duration 字段（如果不存在）
  const captureColumns = db.prepare("PRAGMA table_info(captures)").all() as any[]
  const hasCategory = captureColumns.some(c => c.name === 'category')
  const hasDuration = captureColumns.some(c => c.name === 'duration')
  if (!hasCategory) db.exec("ALTER TABLE captures ADD COLUMN category TEXT NOT NULL DEFAULT ''")
  if (!hasDuration) db.exec("ALTER TABLE captures ADD COLUMN duration REAL NOT NULL DEFAULT 0")

  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')

  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

/* ------------------------------------------------------------------ */
/*  History CRUD                                                       */
/* ------------------------------------------------------------------ */

export interface HistoryListItem {
  id: string
  createdAt: number
  reportType: string
  startDate: string
  endDate: string
  windowTitle: string
  ocrPreview: string
  reportPreview: string
}

export interface HistoryItem extends HistoryListItem {
  ocrText: string
  reportText: string
  template: string
  provider: string
  model: string
}

function preview(s: string, n: number): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length > n ? t.slice(0, n) + '…' : t
}

export function historySave(input: Omit<HistoryItem, 'id'> & { id?: string }): HistoryItem {
  const d = getDb()
  const id = input.id || crypto.randomUUID()
  d.prepare(`
    INSERT OR REPLACE INTO history
    (id, created_at, report_type, start_date, end_date, window_title, ocr_preview, report_preview, ocr_text, report_text, template, provider, model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.createdAt,
    input.reportType,
    input.startDate,
    input.endDate,
    input.windowTitle,
    preview(input.ocrText, 120),
    preview(input.reportText, 140),
    input.ocrText,
    input.reportText,
    input.template,
    input.provider,
    input.model
  )
  return { ...input, id }
}

export function historyGet(id: string): HistoryItem | null {
  const d = getDb()
  const row = d.prepare('SELECT * FROM history WHERE id = ?').get(id) as any
  if (!row) return null
  return {
    id: row.id,
    createdAt: row.created_at,
    reportType: row.report_type,
    startDate: row.start_date,
    endDate: row.end_date,
    windowTitle: row.window_title,
    ocrPreview: row.ocr_preview,
    reportPreview: row.report_preview,
    ocrText: row.ocr_text,
    reportText: row.report_text,
    template: row.template,
    provider: row.provider,
    model: row.model
  }
}

export function historyDelete(id: string): void {
  const d = getDb()
  d.prepare('DELETE FROM history WHERE id = ?').run(id)
}

export function historyList(query: string): HistoryListItem[] {
  const d = getDb()
  const q = (query ?? '').trim().toLowerCase()

  let rows: any[]
  if (!q) {
    rows = d.prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT 200').all()
  } else {
    rows = d.prepare(`
      SELECT * FROM history
      WHERE LOWER(report_type) LIKE ? OR LOWER(start_date) LIKE ? OR LOWER(end_date) LIKE ?
         OR LOWER(window_title) LIKE ? OR LOWER(ocr_preview) LIKE ? OR LOWER(report_preview) LIKE ?
      ORDER BY created_at DESC LIMIT 200
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }

  return rows.map((r: any) => ({
    id: r.id,
    createdAt: r.created_at,
    reportType: r.report_type,
    startDate: r.start_date,
    endDate: r.end_date,
    windowTitle: r.window_title,
    ocrPreview: r.ocr_preview,
    reportPreview: r.report_preview
  }))
}

/* ------------------------------------------------------------------ */
/*  Captures (采集数据)                                                 */
/* ------------------------------------------------------------------ */

export interface CaptureEntry {
  id: number
  date: string
  timestamp: number
  ocrText: string
  windowTitle: string
  category: string
  duration: number
}

export function captureSave(date: string, entry: { timestamp: number; ocrText: string; windowTitle: string; category?: string; duration?: number }): void {
  const d = getDb()
  d.prepare('INSERT INTO captures (date, timestamp, ocr_text, window_title, category, duration) VALUES (?, ?, ?, ?, ?, ?)').run(
    date, entry.timestamp, entry.ocrText, entry.windowTitle, entry.category || '', entry.duration || 0
  )
}

export function captureListByDate(date: string): CaptureEntry[] {
  const d = getDb()
  const rows = d.prepare('SELECT * FROM captures WHERE date = ? ORDER BY timestamp ASC').all(date) as any[]
  return rows.map((r: any) => ({
    id: r.id,
    date: r.date,
    timestamp: r.timestamp,
    ocrText: r.ocr_text,
    windowTitle: r.window_title,
    category: r.category || '',
    duration: r.duration || 0
  }))
}

export function captureListByRange(startDate: string, endDate: string): CaptureEntry[] {
  const d = getDb()
  const rows = d.prepare('SELECT * FROM captures WHERE date >= ? AND date <= ? ORDER BY date ASC, timestamp ASC').all(startDate, endDate) as any[]
  return rows.map((r: any) => ({
    id: r.id,
    date: r.date,
    timestamp: r.timestamp,
    ocrText: r.ocr_text,
    windowTitle: r.window_title,
    category: r.category || '',
    duration: r.duration || 0
  }))
}

export function captureCountByRange(startDate: string, endDate: string): number {
  const d = getDb()
  const row = d.prepare('SELECT COUNT(*) as cnt FROM captures WHERE date >= ? AND date <= ?').get(startDate, endDate) as any
  return row?.cnt ?? 0
}

export function captureDeleteByDate(date: string): void {
  const d = getDb()
  d.prepare('DELETE FROM captures WHERE date = ?').run(date)
}

/* ------------------------------------------------------------------ */
/*  窗口使用时间统计                                                   */
/* ------------------------------------------------------------------ */

export interface WindowUsageStat {
  windowTitle: string
  count: number  // 采集次数
  percentage: number  // 占比百分比
  firstTime: string  // 首次使用时间
  lastTime: string   // 最后使用时间
}

/**
 * 统计指定日期范围内各窗口的使用时间占比
 * 基于采集次数计算（每次采集视为一个时间点）
 */
export function getWindowUsageStats(startDate: string, endDate: string): WindowUsageStat[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT window_title, COUNT(*) as cnt,
           MIN(timestamp) as first_ts,
           MAX(timestamp) as last_ts
    FROM captures
    WHERE date >= ? AND date <= ?
    GROUP BY window_title
    ORDER BY cnt DESC
  `).all(startDate, endDate) as any[]

  const total = rows.reduce((sum, r) => sum + r.cnt, 0)
  if (total === 0) return []

  const formatTime = (ts: number) => {
    if (!ts) return '-'
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return rows.map(r => ({
    windowTitle: r.window_title || '未知窗口',
    count: r.cnt,
    percentage: Math.round((r.cnt / total) * 100),
    firstTime: formatTime(r.first_ts),
    lastTime: formatTime(r.last_ts)
  }))
}

/* ------------------------------------------------------------------ */
/*  Templates (报告模板)                                               */
/* ------------------------------------------------------------------ */

export interface TemplateItem {
  id: string
  name: string
  reportType: string
  content: string
  createdAt: number
  updatedAt: number
}

export function templateList(reportType?: string): TemplateItem[] {
  const d = getDb()
  let rows: any[]
  if (reportType) {
    rows = d.prepare('SELECT * FROM templates WHERE report_type = ? ORDER BY updated_at DESC').all(reportType)
  } else {
    rows = d.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all()
  }
  return rows.map((r: any) => ({
    id: r.id, name: r.name, reportType: r.report_type,
    content: r.content, createdAt: r.created_at, updatedAt: r.updated_at
  }))
}

export function templateSave(input: Omit<TemplateItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): TemplateItem {
  const d = getDb()
  const id = input.id || crypto.randomUUID()
  const now = Date.now()
  d.prepare(`
    INSERT OR REPLACE INTO templates (id, name, report_type, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.name, input.reportType, input.content, now, now)
  return { ...input, id, createdAt: now, updatedAt: now }
}

export function templateDelete(id: string): void {
  const d = getDb()
  d.prepare('DELETE FROM templates WHERE id = ?').run(id)
}

/* ------------------------------------------------------------------ */
/*  Data Management (数据管理)                                         */
/* ------------------------------------------------------------------ */

export function exportAllData(): { history: any[]; captures: any[]; templates: any[] } {
  const d = getDb()
  return {
    history: d.prepare('SELECT * FROM history ORDER BY created_at DESC').all(),
    captures: d.prepare('SELECT * FROM captures ORDER BY timestamp ASC').all(),
    templates: d.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all()
  }
}

export function importData(data: { history?: any[]; captures?: any[]; templates?: any[] }): void {
  const d = getDb()
  const tx = d.transaction(() => {
    if (data.history?.length) {
      for (const r of data.history) {
        d.prepare(`
          INSERT OR REPLACE INTO history
          (id, created_at, report_type, start_date, end_date, window_title, ocr_preview, report_preview, ocr_text, report_text, template, provider, model)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(r.id, r.created_at, r.report_type, r.start_date, r.end_date, r.window_title, r.ocr_preview, r.report_preview, r.ocr_text, r.report_text, r.template, r.provider, r.model)
      }
    }
    if (data.captures?.length) {
      for (const r of data.captures) {
        d.prepare('INSERT OR IGNORE INTO captures (id, date, timestamp, ocr_text, window_title) VALUES (?, ?, ?, ?, ?)').run(
          r.id, r.date, r.timestamp, r.ocr_text, r.window_title
        )
      }
    }
    if (data.templates?.length) {
      for (const r of data.templates) {
        d.prepare(`
          INSERT OR REPLACE INTO templates (id, name, report_type, content, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(r.id, r.name, r.report_type, r.content, r.created_at, r.updated_at)
      }
    }
  })
  tx()
}

export function clearAllData(): void {
  const d = getDb()
  d.exec('DELETE FROM history; DELETE FROM captures; DELETE FROM templates; DELETE FROM app_stats; DELETE FROM work_records;')
}

/* ------------------------------------------------------------------ */
/*  App Stats (应用使用统计)                                            */
/* ------------------------------------------------------------------ */

export interface AppStatsEntry {
  id: number
  date: string
  appName: string
  totalDuration: number
  firstUsed: number | null
  lastUsed: number | null
  usageCount: number
}

export function appStatsSave(date: string, appName: string, duration: number): void {
  const d = getDb()
  const now = Date.now()
  const existing = d.prepare('SELECT * FROM app_stats WHERE date = ? AND app_name = ?').get(date, appName) as any
  if (existing) {
    d.prepare(`
      UPDATE app_stats SET total_duration = total_duration + ?,
        last_used = ?, usage_count = usage_count + 1
      WHERE date = ? AND app_name = ?
    `).run(duration, now, date, appName)
  } else {
    d.prepare(`
      INSERT INTO app_stats (date, app_name, total_duration, first_used, last_used, usage_count)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(date, appName, duration, now, now)
  }
}

export function appStatsQueryByDateRange(startDate: string, endDate: string): AppStatsEntry[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT id, date, app_name, total_duration, first_used, last_used, usage_count
    FROM app_stats WHERE date >= ? AND date <= ?
    ORDER BY total_duration DESC
  `).all(startDate, endDate) as any[]
  return rows.map(r => ({
    id: r.id,
    date: r.date,
    appName: r.app_name,
    totalDuration: r.total_duration,
    firstUsed: r.first_used,
    lastUsed: r.last_used,
    usageCount: r.usage_count
  }))
}

/* ------------------------------------------------------------------ */
/*  Work Records (工作记录)                                            */
/* ------------------------------------------------------------------ */

export interface WorkRecordEntry {
  id: number
  timestamp: number
  category: string
  description: string
  appName: string
  windowTitle: string
  duration: number
  displayId: number
  isPrivate: boolean
  rawText: string
  createdAt: number
}

export function workRecordsSave(record: Omit<WorkRecordEntry, 'id' | 'createdAt'>): WorkRecordEntry {
  const d = getDb()
  const now = Date.now()
  const result = d.prepare(`
    INSERT INTO work_records (timestamp, category, description, app_name, window_title, duration, display_id, is_private, raw_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.timestamp, record.category, record.description, record.appName,
    record.windowTitle, record.duration, record.displayId,
    record.isPrivate ? 1 : 0, record.rawText, now
  )
  return { ...record, id: Number(result.lastInsertRowid), createdAt: now }
}

export function workRecordsQueryByDate(date: string): WorkRecordEntry[] {
  const d = getDb()
  const startTs = new Date(date + 'T00:00:00').getTime()
  const endTs = new Date(date + 'T23:59:59').getTime()
  const rows = d.prepare(`
    SELECT * FROM work_records WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `).all(startTs, endTs) as any[]
  return rows.map(r => ({
    id: r.id, timestamp: r.timestamp, category: r.category,
    description: r.description, appName: r.app_name, windowTitle: r.window_title,
    duration: r.duration, displayId: r.display_id,
    isPrivate: r.is_private === 1, rawText: r.raw_text, createdAt: r.created_at
  }))
}

export function workRecordsQueryByDateRange(startDate: string, endDate: string): WorkRecordEntry[] {
  const d = getDb()
  const startTs = new Date(startDate + 'T00:00:00').getTime()
  const endTs = new Date(endDate + 'T23:59:59').getTime()
  const rows = d.prepare(`
    SELECT * FROM work_records WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `).all(startTs, endTs) as any[]
  return rows.map(r => ({
    id: r.id, timestamp: r.timestamp, category: r.category,
    description: r.description, appName: r.app_name, windowTitle: r.window_title,
    duration: r.duration, displayId: r.display_id,
    isPrivate: r.is_private === 1, rawText: r.raw_text, createdAt: r.created_at
  }))
}
