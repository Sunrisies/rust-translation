#!/usr/bin/env python3
"""静态站预览服务器（支持无后缀路由补 .html）。用法: python serve.py <site目录> <端口>"""
import http.server, os, sys
from pathlib import Path
root = Path(sys.argv[1]).resolve()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 3600
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=str(root), **kw)
    def do_GET(self):
        p = self.path.split('?')[0]
        f = root / p.lstrip('/')
        if not os.path.splitext(p)[1] and not f.exists() and (str(f)+'.html') and Path(str(f)+'.html').exists():
            self.path = p + '.html'
        return super().do_GET()
print(f"预览: http://127.0.0.1:{port}  (root: {root})", flush=True)
http.server.HTTPServer(('127.0.0.1', port), H).serve_forever()
