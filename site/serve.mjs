// 轻量静态服务器：修正 SVG 等关键 MIME，供本地预览静态站
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'

const root = resolve('D:/hy-mt2-bench/nuxt-docs/site/.output/public')
const port = 3200

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0])
  if (urlPath === '/') urlPath = '/index.html'

  // 去掉前导斜杠，避免 join 在 Windows 下拼接异常
  let rel = urlPath.replace(/^\/+/, '')
  let filePath = join(root, rel)

  // 无扩展名：优先试 .html（Docus 站内链接都是无后缀的）
  if (!extname(rel)) {
    if (existsSync(filePath + '.html')) filePath += '.html'
    else if (existsSync(join(filePath, 'index.html'))) filePath = join(filePath, 'index.html')
  }
  // 目录 -> index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html')
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('404 Not Found: ' + urlPath)
    return
  }

  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  createReadStream(filePath).pipe(res)
}).listen(port, '127.0.0.1', () => {
  console.log(`静态服务器运行于 http://127.0.0.1:${port}  (root: ${root})`)
})
