#!/usr/bin/env node
/**
 * 预生成应用图标 PNG 文件
 * 运行: node generate-icons.js
 * 输出: icons/icon-16.png, icons/icon-32.png, icons/icon-64.png, icons/icon-256.png
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const BG = [255, 255, 255, 255]   // 白色背景
const BLUE = [66, 133, 244, 255]   // #4285F4 蓝色文档

function createIcon(size) {
  const data = Buffer.alloc(size * size * 4)
  const s = size / 64

  // 白色背景（全填充）
  for (let i = 0; i < size * size * 4; i += 4) {
    data[i] = BG[0]; data[i + 1] = BG[1]; data[i + 2] = BG[2]; data[i + 3] = BG[3]
  }

  // 蓝色文档矩形
  const dL = Math.round(16 * s), dT = Math.round(6 * s)
  const dW = Math.round(32 * s), dH = Math.round(52 * s)
  for (let y = dT; y < dT + dH; y++) {
    for (let x = dL; x < dL + dW; x++) {
      if (y >= 0 && y < size && x >= 0 && x < size) {
        const i = (y * size + x) * 4
        data[i] = BLUE[0]; data[i + 1] = BLUE[1]; data[i + 2] = BLUE[2]; data[i + 3] = BLUE[3]
      }
    }
  }

  // 白色折角（右上角三角形）
  const fW = Math.round(10 * s)
  for (let y = dT; y < dT + fW; y++) {
    for (let x = dL + dW - fW; x < dL + dW; x++) {
      if (y >= 0 && y < size && x >= 0 && x < size) {
        const tx = x - (dL + dW - fW), ty = y - dT
        if (tx + ty < fW) {
          const i = (y * size + x) * 4
          data[i] = BG[0]; data[i + 1] = BG[1]; data[i + 2] = BG[2]; data[i + 3] = BG[3]
        }
      }
    }
  }

  return dataToPNG(data, size, size)
}

function dataToPNG(rgba, width, height) {
  // PNG 文件结构
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // 原始像素数据（每行前加 filter byte = 0）
  const rawData = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0 // filter: none
    rgba.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const compressed = zlib.deflateSync(rawData)

  // 组装
  const chunks = [signature]
  chunks.push(makeChunk('IHDR', ihdr))
  chunks.push(makeChunk('IDAT', compressed))
  chunks.push(makeChunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(chunks)
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeB = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeB, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeB, data, crc])
}

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0)
    }
  }
  return (c ^ 0xFFFFFFFF) >>> 0
}

function createIco() {
  const sizes = [16, 32, 64, 256]
  const pngs = sizes.map(s => ({ size: s, data: createIcon(s) }))

  // ICO 头
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)   // reserved
  header.writeUInt16LE(1, 2)   // type: 1 = icon
  header.writeUInt16LE(sizes.length, 4)

  // 计算偏移：header + 每个条目 16 字节
  let offset = 6 + sizes.length * 16
  const entries = []
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16)
    const w = size >= 256 ? 0 : size
    const h = size >= 256 ? 0 : size
    entry.writeUInt8(w, 0)
    entry.writeUInt8(h, 1)
    entry.writeUInt8(0, 2)  // palette
    entry.writeUInt8(0, 3)  // reserved
    entry.writeUInt16LE(1, 4)   // planes
    entry.writeUInt16LE(32, 6)  // bpp
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(entry)
  }

  return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)])
}

// 生成各尺寸图标
const outDir = path.join(__dirname, 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [16, 32, 64, 256]) {
  const png = createIcon(size)
  const outPath = path.join(outDir, `icon-${size}.png`)
  fs.writeFileSync(outPath, png)
  console.log(`✓ 已生成: icons/icon-${size}.png (${png.length} bytes)`)
}

const ico = createIco()
const icoPath = path.join(outDir, 'icon.ico')
fs.writeFileSync(icoPath, ico)
console.log(`✓ 已生成: icons/icon.ico (${ico.length} bytes)`)

console.log('\n图标生成完成！')
