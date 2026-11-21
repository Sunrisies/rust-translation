// 把静态 HTML 里的 CSS 图标 <span class="i-lucide-xxx"> 替换成内联 SVG
// 原因：静态生成时 Nuxt Icon 的 CSS 图标未打包，会显示成空方块。
// 内联 SVG 不依赖任何运行时，任何静态托管都能显示。
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const siteDir = resolve(import.meta.dirname, '..')
const publicDir = join(siteDir, '.output/public')
const pnpmDir = join(siteDir, 'node_modules/.pnpm')

// 加载 iconify JSON 集合
function loadCollection(prefix) {
  const dirs = readdirSync(pnpmDir).filter(d => d.startsWith(`@iconify-json+${prefix}@`))
  if (!dirs.length) return null
  const jsonPath = join(pnpmDir, dirs[0], `node_modules/@iconify-json/${prefix}/icons.json`)
  if (!existsSync(jsonPath)) return null
  return JSON.parse(readFileSync(jsonPath, 'utf8'))
}

const collections = {
  'i-lucide': loadCollection('lucide'),
  'i-simple-icons': loadCollection('simple-icons'),
}
console.log('[inline-icons] 已加载集合:',
  Object.entries(collections).map(([k, v]) => `${k}=${v ? Object.keys(v.icons).length : 0}`).join(', '))

function iconToSvg(fullName, cls) {
  const [prefix, ...nameParts] = fullName.split('-')
  // prefix 是 i-lucide / i-simple-icons：重新拼
  let col, iconName
  if (fullName.startsWith('i-simple-icons-')) {
    col = collections['i-simple-icons']; iconName = fullName.slice('i-simple-icons-'.length)
  } else if (fullName.startsWith('i-lucide-')) {
    col = collections['i-lucide']; iconName = fullName.slice('i-lucide-'.length)
  } else {
    return null
  }
  // 新版 lucide 改名 alias（Nuxt UI 用的是旧名）
  const ALIAS = {
    'triangle-alert': 'triangle-exclamation-point',
    'alert-triangle': 'triangle-exclamation-point',
    'circle-alert': 'circle-exclamation-point',
    'alert-circle': 'circle-exclamation-point',
    'shield-alert': 'shield-exclamation-point',
  }
  const resolved = (col && col.icons[iconName]) ? iconName : ALIAS[iconName]
  if (!col || !resolved || !col.icons[resolved]) return null
  const icon = col.icons[resolved]
  const w = col.width || 24, h = col.height || 24
  const body = icon.body
  // 保留原 class（含 tailwind 尺寸类），追加 svg 标识
  const extra = cls ? ` class="${cls}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="1em" height="1em" fill="currentColor"${extra}>${body}</svg>`
}

// 递归收集 html
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.html')) out.push(p)
  }
  return out
}

const files = walk(publicDir)
let totalReplaced = 0
// 匹配 <span class="...i-xxx..." ...>...</span>（允许 class 里有其他属性和任意内容）
const pattern = /<span\b[^>]*\bclass="[^"]*\bi-(?:lucide|simple-icons)[-:][a-z0-9-]+[^"]*"[^>]*?(?:\/>|>\s*<\/span>)/g

function resolveIcon(cls) {
  // 支持 i-lucide-rocket 和 i-lucide:rocket 两种写法
  let m = cls.match(/\bi-(lucide|simple-icons):([a-z0-9-]+)/)
  if (m) return { name: `i-${m[1]}-${m[2]}`, token: m[0] }
  m = cls.match(/\bi-(?:lucide|simple-icons)-[a-z0-9-]+/)
  if (m) return { name: m[0], token: m[0] }
  return null
}

for (const f of files) {
  let html = readFileSync(f, 'utf8')
  let n = 0
  const out = html.replace(pattern, (match) => {
    const clsMatch = match.match(/\bclass="([^"]*)"/)
    if (!clsMatch) return match
    const cls = clsMatch[1]
    const icon = resolveIcon(cls)
    if (!icon) return match
    const svg = iconToSvg(icon.name, cls.replace(icon.token, '').trim())
    if (!svg) return match
    n++
    return svg
  })
  if (n > 0) {
    writeFileSync(f, out, 'utf8')
    totalReplaced += n
  }
}
console.log(`[inline-icons] 处理 ${files.length} 个 HTML，替换 ${totalReplaced} 个图标`)
