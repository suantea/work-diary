export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatTs(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function displayHotkey(accelerator: string): string {
  const map: Record<string, string> = {
    CommandOrControl: 'Ctrl', Control: 'Ctrl', Ctrl: 'Ctrl',
    Alt: 'Alt', Shift: 'Shift', Meta: 'Win'
  }
  return accelerator.split('+').map(part => map[part] || part.toUpperCase()).join(' + ')
}
