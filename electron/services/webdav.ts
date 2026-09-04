import { createClient } from 'webdav'
import { getDb } from './database'
import { getSettings } from './settings'
import https from 'https'
import os from 'os'

const UPLOAD_TIMEOUT = 30000

function makeAgent() {
  return new https.Agent({ keepAlive: true, timeout: UPLOAD_TIMEOUT, rejectUnauthorized: true })
}

function getClient() {
  const s = getSettings()
  if (!s.webdavUrl || !s.webdavUsername || !s.webdavPassword) {
    throw new Error('WebDAV 配置不完整，请先填写服务器地址、用户名和密码')
  }
  return createClient(s.webdavUrl, {
    username: s.webdavUsername,
    password: s.webdavPassword,
    httpsAgent: makeAgent()
  })
}

function hostname() {
  return os.hostname().replace(/[\\/:*?"<>|]/g, '_')
}

/** 采集记录 → 单日 MD 内容 */
function capturesToMd(date: string, captures: any[]): string {
  const lines: string[] = []
  lines.push(`# ${date} (${hostname()})`, '')
  for (const c of captures) {
    const d = new Date(c.timestamp)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const time = `${date} ${hh}:${mm}:${ss}`
    lines.push(`## ${time} — ${c.window_title || '(无标题)'}`, '')
    if (c.ocr_text) lines.push(c.ocr_text, '')
    lines.push('---', '')
  }
  return lines.join('\n')
}

/** 单日 MD → 采集记录数组 */
function mdToCaptures(date: string, md: string): any[] {
  const captures: any[] = []
  const sectionRe = /^## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) — (.+)$/gm
  const sepRe = /^---$/m
  const sections = [...md.matchAll(sectionRe)]
  const sepIndexes = [...md.matchAll(sepRe)].map(m => m.index)
  for (let i = 0; i < sections.length; i++) {
    const match = sections[i]
    const ts = new Date(match[1]).getTime()
    const title = match[2]
    const start = match.index + match[0].length
    const end = i < sections.length - 1 ? sections[i + 1].index : md.length
    const body = md.slice(start, end).trim()
    const ocrText = body.replace(sepRe, '').trim()
    captures.push({ date, timestamp: ts, window_title: title, ocr_text: ocrText })
  }
  return captures
}

/** 测试 WebDAV 连接（包含读写测试） */
export async function webdavTestConnection(
  url: string, username: string, password: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const client = createClient(url, { username, password, httpsAgent: makeAgent() })
    await client.getDirectoryContents('/')
    // 额外测试写入权限
    try {
      const testFile = '.wdav_test.tmp'
      await client.putFileContents(testFile, 'ok', { overwrite: true })
      await client.deleteFile(testFile)
    } catch {
      return { ok: false, message: '连接成功但无写入权限，请检查服务器目录权限' }
    }
    return { ok: true, message: '连接成功（读写正常）' }
  } catch (e: any) {
    const msg = e?.message || String(e)
    if (msg.includes('401') || msg.includes('403')) return { ok: false, message: '认证失败，请检查用户名和密码' }
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) return { ok: false, message: '无法连接到服务器，请检查地址' }
    return { ok: false, message: `连接失败：${msg}` }
  }
}

/** 增量上传：只上传上次同步后有新数据的日期 */
export async function webdavSyncUp(): Promise<{ ok: boolean; message: string; timestamp: number }> {
  try {
    const client = getClient()
    const db = getDb()
    const lastSync = getSettings().webdavLastSyncTime || 0
    const now = Date.now()

    // 找出有新采集记录的日期（按 timestamp 判断，不依赖 webdav 服务器）
    const newDates = db.prepare(`
      SELECT DISTINCT date FROM captures WHERE timestamp > ? ORDER BY date ASC
    `).pluck().all(lastSync) as string[]

    if (newDates.length === 0) return { ok: false, message: '没有新数据需要同步', timestamp: now }

    let uploaded = 0
    const errors: string[] = []

    for (const date of newDates) {
      const dayCaps = db.prepare('SELECT * FROM captures WHERE date = ? ORDER BY timestamp ASC').all(date) as any[]
      const filename = `${date}(${hostname()}).md`
      const md = capturesToMd(date, dayCaps)
      try {
        await client.putFileContents(filename, md, {
          overwrite: true,
          contentLength: true,
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT),
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
        })
        uploaded++
      } catch (e: any) {
        errors.push(`${date}: ${e?.message || e}`)
      }
    }

    // 更新元数据
    try {
      await client.putFileContents('.work-report-meta.json', JSON.stringify({ lastSyncTime: now, version: 2 }), {
        overwrite: true,
        signal: AbortSignal.timeout(10000)
      })
    } catch {}

    if (errors.length > 0) {
      return { ok: false, message: `已上传 ${uploaded}/${newDates.length} 天，失败 ${errors.length} 天。例如：${errors[0]}`, timestamp: now }
    }
    return { ok: true, message: `同步成功：更新了 ${uploaded} 天`, timestamp: now }
  } catch (e: any) {
    return { ok: false, message: `上传失败：${e?.message || String(e)}`, timestamp: 0 }
  }
}

/** 下载：从 WebDAV 读取所有 MD 文件并恢复 */
export async function webdavSyncDown(): Promise<{ ok: boolean; message: string; timestamp: number }> {
  try {
    const client = getClient()
    const items = await client.getDirectoryContents('/') as any[]
    const mdFiles = items.filter((i: any) => i.basename.endsWith('.md') && i.basename.includes('('))

    if (mdFiles.length === 0) return { ok: false, message: '云端没有备份文件', timestamp: 0 }

    let imported = 0
    const errors: string[] = []
    const allCaptures: any[] = []
    const db = getDb()

    for (const file of mdFiles) {
      const filename = file.basename as string
      try {
        const content = await client.getFileContents(filename, { format: 'text' })
        const date = filename.split('(')[0]
        const caps = mdToCaptures(date, typeof content === 'string' ? content : String(content))
        allCaptures.push(...caps)
        imported += caps.length
      } catch (e: any) {
        errors.push(`${filename}: ${e?.message || e}`)
      }
    }

    // 写入数据库
    if (allCaptures.length > 0) {
      const d = getDb()
      const tx = d.transaction(() => {
        for (const c of allCaptures) {
          d.prepare('INSERT OR IGNORE INTO captures (date, timestamp, ocr_text, window_title) VALUES (?, ?, ?, ?)').run(
            c.date, c.timestamp, c.ocr_text, c.window_title
          )
        }
      })
      tx()
    }

    let timestamp = Date.now()
    try {
      const metaContent = await client.getFileContents('.work-report-meta.json', { format: 'text' }) as string
      const meta = JSON.parse(metaContent)
      if (meta.lastSyncTime) timestamp = meta.lastSyncTime
    } catch {}

    if (errors.length > 0) {
      return { ok: false, message: `已恢复 ${imported} 条记录，${errors.length} 个文件失败：${errors[0]}`, timestamp }
    }
    return { ok: true, message: `数据恢复成功：共 ${imported} 条记录`, timestamp }
  } catch (e: any) {
    return { ok: false, message: `下载失败：${e?.message || String(e)}`, timestamp: 0 }
  }
}

/** 查看云端状态 */
export async function webdavStatus(): Promise<{ exists: boolean; lastSyncTime: number }> {
  try {
    const client = getClient()
    const items = await client.getDirectoryContents('/') as any[]
    const hasFiles = items.some((i: any) => i.basename.endsWith('.md'))
    let lastSyncTime = getSettings().webdavLastSyncTime || 0
    try {
      const metaContent = await client.getFileContents('.work-report-meta.json', { format: 'text' }) as string
      lastSyncTime = JSON.parse(metaContent).lastSyncTime || lastSyncTime
    } catch {}
    return { exists: hasFiles, lastSyncTime }
  } catch {
    return { exists: false, lastSyncTime: 0 }
  }
}
