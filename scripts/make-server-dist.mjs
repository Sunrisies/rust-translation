#!/usr/bin/env node
// 从 WorkBuddy 版产物生成自有服务器版：把 Umami 脚本换成 recorder.js + 服务器专用 id
// WorkBuddy: script.js + 1b580d0f-9fca-40f0-a513-1401faa8d557
// 自有服务器: recorder.js + a95f5257-96c9-4c01-aa90-8c9d683ac000
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, cpSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'site/.output/public')
const DIST = join(ROOT, 'deploy-server/public')

const WB_SCRIPT = 'https://umami.sunrise1024.top/script.js'
const WB_ID = '1b580d0f-9fca-40f0-a513-1401faa8d557'
const SRV_SCRIPT = 'https://umami.sunrise1024.top/recorder.js'
const SRV_ID = 'a95f5257-96c9-4c01-aa90-8c9d683ac000'

// 重建 dist（环境拦截删除，用改名链移走旧目录，避免合并残留）
if (existsSync(DIST)) {
  const stamp = Date.now()
  try { renameSync(DIST, `${DIST}_old_${stamp}`) } catch { /* 忽略 */ }
}
mkdirSync(DIST, { recursive: true })

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

let n = 0
for (const f of walk(SRC)) {
  const rel = f.slice(SRC.length)
  const target = join(DIST, rel)
  mkdirSync(join(target, '..'), { recursive: true })
  if (f.endsWith('.html')) {
    let html = readFileSync(f, 'utf8')
    if (html.includes(WB_SCRIPT) || html.includes(WB_ID)) {
      html = html.replaceAll(WB_SCRIPT, SRV_SCRIPT).replaceAll(WB_ID, SRV_ID)
      n++
    }
    writeFileSync(target, html, 'utf8')
  } else {
    cpSync(f, target)
  }
}
console.log(`[make-server-dist] 转换 ${n} 个 HTML -> recorder.js + ${SRV_ID}`)
