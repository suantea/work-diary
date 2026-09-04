import {
  historySave as dbHistorySave,
  historyGet as dbHistoryGet,
  historyDelete as dbHistoryDelete,
  historyList as dbHistoryList,
  closeDb,
  type HistoryListItem as DBHistoryListItem,
  type HistoryItem as DBHistoryItem
} from './database'

// 重新导出类型
export type { DBHistoryListItem as HistoryListItem, DBHistoryItem as HistoryItem }

export async function historySave(input: Omit<DBHistoryItem, 'id'>): Promise<DBHistoryItem> {
  return dbHistorySave(input)
}

export async function historyGet(id: string): Promise<DBHistoryItem> {
  const item = dbHistoryGet(id)
  if (!item) throw new Error('记录不存在')
  return item
}

export async function historyDelete(id: string): Promise<void> {
  dbHistoryDelete(id)
}

export async function historyList(query: string): Promise<DBHistoryListItem[]> {
  return dbHistoryList(query)
}

export { closeDb }
