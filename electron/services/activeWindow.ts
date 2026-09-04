import { execFile } from 'node:child_process'

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Force PowerShell to output UTF-8 via chcp 65001
    const prefix = 'chcp 65001 > $null; $OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', prefix + script],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr?.toString()?.trim() || err.message))
        // PowerShell outputs UTF-8 via chcp 65001
        const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? '')
        resolve(buf.toString('utf-8').trim())
      }
    )
  })
}

export async function getActiveWindowTitle(): Promise<string> {
  const script = [
    "Add-Type @'",
    'using System;',
    'using System.Runtime.InteropServices;',
    'using System.Text;',
    'public class Win32 {',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
    '}',
    "'@;",
    '$h=[Win32]::GetForegroundWindow();',
    '$sb=New-Object System.Text.StringBuilder 4096;',
    '[void][Win32]::GetWindowText($h,$sb,$sb.Capacity);',
    '$sb.ToString()'
  ].join('\n')

  try {
    return await runPowerShell(script)
  } catch {
    return ''
  }
}

export interface WindowRect { left: number; top: number; width: number; height: number }

export async function getActiveWindowRect(): Promise<WindowRect | null> {
  const script = [
    "Add-Type @'",
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class Win32 {',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
    '  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
    '}',
    "'@;",
    '$h=[Win32]::GetForegroundWindow();',
    '$r=New-Object Win32+RECT;',
    '[void][Win32]::GetWindowRect($h,[ref]$r);',
    "$($r.Left),$($r.Top),$($r.Right),$($r.Bottom)"
  ].join('\n')

  try {
    const result = await runPowerShell(script)
    const parts = result.split(',').map(Number)
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      return {
        left: parts[0],
        top: parts[1],
        width: parts[2] - parts[0],
        height: parts[3] - parts[1]
      }
    }
    return null
  } catch {
    return null
  }
}

