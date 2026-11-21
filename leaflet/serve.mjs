import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
const root = resolve('D:/hy-mt2-bench/leaflet-docs/site-official')
const port = 3500
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'}
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html'
  let f=join(root,p.replace(/^\/+/,''))
  if(!extname(p)&&!existsSync(f)&&existsSync(f+'.html'))f+='.html'
  if(existsSync(f)&&statSync(f).isDirectory())f=join(f,'index.html')
  if(!existsSync(f)){res.writeHead(404);res.end('404');return}
  res.writeHead(200,{'Content-Type':MIME[extname(f)]||'application/octet-stream'})
  createReadStream(f).pipe(res)
}).listen(port,'127.0.0.1',()=>console.log(`Leaflet ZH: http://127.0.0.1:${port}`))
