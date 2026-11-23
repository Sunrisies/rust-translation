#!/usr/bin/env bash
# 一键启动 Rust 中文文档的本地预览服务（五本书，五个端口）
# 用法: bash D:/hy-mt2-bench/nuxt-docs/rust/_shared/start_servers.sh
# 注意：这是长驻服务，命令会一直运行（Ctrl+C 停止全部）。
# 若只想单独启动一本，见下方"单独启动"说明。

set -e
ROOT="D:/hy-mt2-bench/nuxt-docs"
SHARED="$ROOT/rust/_shared"

echo "============================================"
echo " Rust 中文文档本地预览"
echo "============================================"
echo "  Clippy Book    -> http://127.0.0.1:3600/"
echo "  Error Codes    -> http://127.0.0.1:3601/"
echo "  The Reference  -> http://127.0.0.1:3602/"
echo "  Cargo Book     -> http://127.0.0.1:3603/"
echo "  The Book       -> http://127.0.0.1:3604/"
echo "============================================"

# 用 Python 在一个进程里同时起三个 HTTP 服务（避免开三个终端）
python - "$SHARED" "$ROOT" <<'PY'
import http.server, os, sys, threading
from pathlib import Path

shared, root = Path(sys.argv[1]), Path(sys.argv[2])
BOOKS = [
    ("Clippy Book",   root / "rust/clippy/site",    3600),
    ("Error Codes",   root / "rust/error-codes/site", 3601),
    ("The Reference", root / "rust/reference/site",  3602),
    ("Cargo Book",    root / "rust/cargo/site",     3603),
    ("The Book",      root / "rust/book/site",      3604),
]

class H(http.server.SimpleHTTPRequestHandler):
    site_root = None
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(self.site_root), **kw)
    def do_GET(self):
        p = self.path.split("?")[0]
        f = self.site_root / p.lstrip("/")
        if not os.path.splitext(p)[1] and not f.exists() and Path(str(f) + ".html").exists():
            self.path = p + ".html"
        return super().do_GET()
    def log_message(self, fmt, *args):  # 静默日志
        pass

for name, site, port in BOOKS:
    if not site.exists():
        print(f"  [跳过] {name}: 站点目录不存在 {site}")
        continue
    handler = type(f"H{port}", (H,), {"site_root": site})
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f"  [启动] {name}: http://127.0.0.1:{port}/")

print("\n服务已就绪，浏览器打开上面地址即可。按 Ctrl+C 停止全部。\n")
try:
    threading.Event().wait()
except KeyboardInterrupt:
    print("\n已停止。")
PY

# ---------- 单独启动某一本（按需取消注释）----------
# python "$SHARED/serve.py" "$ROOT/rust/clippy/site" 3600
# python "$SHARED/serve.py" "$ROOT/rust/error-codes/site" 3601
# python "$SHARED/serve.py" "$ROOT/rust/reference/site" 3602
# python "$SHARED/serve.py" "$ROOT/rust/cargo/site" 3603
# python "$SHARED/serve.py" "$ROOT/rust/book/site" 3604
