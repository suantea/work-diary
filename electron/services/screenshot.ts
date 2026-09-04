import screenshot from 'screenshot-desktop'
import { nativeImage } from 'electron'
import type { WindowRect } from './activeWindow'

/** 显示器信息 */
export interface DisplayInfo {
  id: string
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
  dpiScale: number
}

/**
 * 列出所有显示器
 */
export async function listDisplays(): Promise<DisplayInfo[]> {
  try {
    const displays = await (screenshot as any).listDisplays()
    return (displays || []).map((d: any) => ({
      id: d.id,
      left: d.left ?? 0,
      top: d.top ?? 0,
      width: d.width ?? 1920,
      height: d.height ?? 1080,
      right: d.right ?? (d.left ?? 0) + (d.width ?? 1920),
      bottom: d.bottom ?? (d.top ?? 0) + (d.height ?? 1080),
      dpiScale: d.dpiScale ?? 1
    }))
  } catch {
    return []
  }
}

/**
 * 根据活动窗口的绝对坐标，找到它所在的显示器
 */
export function findDisplayForWindow(
  displays: DisplayInfo[],
  rect: WindowRect | null
): DisplayInfo | null {
  if (!displays.length || !rect) return displays[0] ?? null
  // 活动窗口中心点
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  // 找包含中心点的显示器
  for (const d of displays) {
    if (cx >= d.left && cx < d.right && cy >= d.top && cy < d.bottom) {
      return d
    }
  }
  // 找不到就返回第一个显示器（主屏）
  return displays[0] ?? null
}

/**
 * 将绝对窗口坐标转换为指定显示器内的相对坐标
 */
export function toDisplayRelative(
  rect: WindowRect | null,
  display: DisplayInfo
): WindowRect | null {
  if (!rect) return null
  return {
    left: rect.left - display.left,
    top: rect.top - display.top,
    width: rect.width,
    height: rect.height
  }
}

/**
 * 使用 screenshot-desktop 截取屏幕
 * @param displayId 指定显示器 ID，为空时截主屏幕
 * 返回 PNG Buffer
 */
export async function captureScreen(displayId?: string): Promise<Buffer> {
  const opts: any = { format: 'png' }
  if (displayId) opts.screen = displayId
  const buf = await screenshot(opts)
  if (!buf || buf.length < 500) {
    throw new Error(`截图数据异常（仅 ${buf?.length ?? 0} bytes）`)
  }
  return buf
}

/**
 * 截图并返回 base64 data URL
 */
export async function captureScreenBase64(): Promise<string> {
  const buf = await captureScreen()
  return `data:image/png;base64,${buf.toString('base64')}`
}

/**
 * 图像预处理：裁剪到活动窗口 + 放大分辨率 + 灰度化
 * 返回处理后的 PNG Buffer
 */
export async function preprocessScreenshot(
  pngBuf: Buffer,
  windowRect: WindowRect | null
): Promise<Buffer> {
  let img = nativeImage.createFromBuffer(pngBuf)
  const { width: screenW, height: screenH } = img.getSize()

  // 1. 裁剪到活动窗口区域（去掉任务栏等噪音）
  if (windowRect && windowRect.width > 100 && windowRect.height > 100) {
    const x = Math.max(0, Math.min(windowRect.left, screenW - 1))
    const y = Math.max(0, Math.min(windowRect.top, screenH - 1))
    const w = Math.min(windowRect.width, screenW - x)
    const h = Math.min(windowRect.height, screenH - y)
    if (w > 50 && h > 50) {
      img = img.crop({ x, y, width: w, height: h })
    }
  }

  // 2. 放大到更高分辨率（OCR 在高分辨率下识别率更高）
  const { width: curW, height: curH } = img.getSize()
  if (curW < 2560) {
    const scale = 2560 / curW
    img = img.resize({ width: Math.round(curW * scale), height: Math.round(curH * scale) })
  }

  return img.toPNG()
}

/**
 * 视觉模型专用预处理：裁剪到活动窗口 + 缩小到 800px + JPEG 压缩
 * 目标：用最少的 token 获得足够清晰的识别效果
 */
export function preprocessForVision(
  pngBuf: Buffer,
  windowRect: WindowRect | null
): { dataUrl: string; format: string } {
  let img = nativeImage.createFromBuffer(pngBuf)
  const { width: screenW, height: screenH } = img.getSize()

  // 1. 裁剪到活动窗口区域
  if (windowRect && windowRect.width > 100 && windowRect.height > 100) {
    const x = Math.max(0, Math.min(windowRect.left, screenW - 1))
    const y = Math.max(0, Math.min(windowRect.top, screenH - 1))
    const w = Math.min(windowRect.width, screenW - x)
    const h = Math.min(windowRect.height, screenH - y)
    if (w > 50 && h > 50) {
      img = img.crop({ x, y, width: w, height: h })
    }
  }

  // 2. 缩小到最大宽度 800px（足够识别文字，大幅减少 token）
  const { width: curW, height: curH } = img.getSize()
  const maxW = 800
  if (curW > maxW) {
    const scale = maxW / curW
    img = img.resize({ width: maxW, height: Math.round(curH * scale) })
  }

  // 3. 转 JPEG（quality 50%，体积 vs 清晰度平衡）
  const jpegBuf = img.toJPEG(50)
  const b64 = jpegBuf.toString('base64')
  return {
    dataUrl: `data:image/jpeg;base64,${b64}`,
    format: 'jpeg'
  }
}
