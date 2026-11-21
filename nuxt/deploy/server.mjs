// 发布专用静态服务器：单端口，绑定 0.0.0.0，读 PORT 环境变量
// 支持无后缀路由补 .html（Docus 站内链接格式）与正确的 SVG MIME
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)))
const root = join(__dirname, 'public')
const port = Number(process.env.PORT || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0])
  if (urlPath === '/') urlPath = '/index.html'

  const rel = urlPath.replace(/^\/+/, '')
  let filePath = join(root, rel)

  // 无扩展名：Docus 站内链接是无后缀的，优先补 .html
  if (!extname(rel)) {
    if (existsSync(filePath + '.html')) filePath += '.html'
    else if (existsSync(join(filePath, 'index.html'))) filePath = join(filePath, 'index.html')
  }
  // 目录 -> index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html')
  }

  if (!existsSync(filePath)) {
    // 404 回退：优先 404.html，否则纯文本
    const fallback = join(root, '404.html')
    if (existsSync(fallback)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      createReadStream(fallback).pipe(res)
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found')
    }
    return
  }

  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  createReadStream(filePath).pipe(res)
}).listen(port, '0.0.0.0', () => {
  console.log(`Nuxt Docs ZH listening on 0.0.0.0:${port}`)
})
