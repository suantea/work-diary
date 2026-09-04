import { execFile } from 'node:child_process'
import { mkdir, writeFile, unlink, access } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

/**
 * Windows OCR PowerShell 脚本内容
 * 通过 Windows.Media.Ocr WinRT API 识别图片文字
 */
const OCR_SCRIPT = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime

# WinRT 类型
$null = [Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]

# WinRT 异步辅助
function Await($WinRtTask, $ResultType) {
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
    })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('zh-CN'))
if (-not $ocrEngine) {
    Write-Error "Windows OCR engine not available"
    exit 1
}

$imagePath = $args[0]
$bytes = [System.IO.File]::ReadAllBytes($imagePath)
$stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
$writer = [Windows.Storage.Streams.DataWriter]::new($stream.GetOutputStreamAt(0))
$writer.WriteBytes($bytes)
$storeTask = [System.WindowsRuntimeSystemExtensions]::AsTask($writer.StoreAsync())
$storeTask.Wait()
$stream.Seek(0)

$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$ocrResult = Await ($ocrEngine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

Write-Output $ocrResult.Text
`.trim()

// PowerShell 脚本缓存路径
let scriptPath: string | null = null

async function ensureScript(): Promise<string> {
  if (scriptPath) {
    try {
      await access(scriptPath)
      return scriptPath
    } catch {}
  }
  const dir = path.join(app.getPath('temp'), 'work-report-winocr')
  await mkdir(dir, { recursive: true })
  scriptPath = path.join(dir, 'ocr.ps1')
  await writeFile(scriptPath, OCR_SCRIPT, 'utf-8')
  return scriptPath
}

/**
 * 使用 Windows OCR API 识别图片中的文字
 * 比传统 OCR 引擎更适合屏幕截图，支持中英文混合
 */
export async function runWindowsOcr(pngPath: string): Promise<string> {
  const script = await ensureScript()

  return await new Promise<string>((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, pngPath],
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Windows OCR 失败：${stderr || err.message}`))
          return
        }
        const text = (stdout || '').trim()
        if (!text) {
          reject(new Error('Windows OCR 返回空文本'))
        } else {
          resolve(text)
        }
      }
    )
  })
}

/**
 * 从 base64 图片数据执行 Windows OCR
 * 先保存为临时文件，再调用 OCR
 */
export async function runWindowsOcrFromBase64(pngBase64: string): Promise<string> {
  // 提取纯 base64 数据
  const idx = pngBase64.indexOf('base64,')
  const raw = idx >= 0 ? pngBase64.slice(idx + 'base64,'.length) : pngBase64
  const buf = Buffer.from(raw, 'base64')

  // 写入临时文件（使用纯 ASCII 路径）
  const tempDir = path.join(app.getPath('temp'), 'work-report-winocr')
  await mkdir(tempDir, { recursive: true })
  const inputPath = path.join(tempDir, `ocr-input-${Date.now()}.png`)
  await writeFile(inputPath, buf)

  try {
    return await runWindowsOcr(inputPath)
  } finally {
    unlink(inputPath).catch(() => {})
  }
}
