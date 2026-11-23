#!/usr/bin/env python3
"""给五本 Rust 中文文档注入统一导航条 + Umami 统计，并生成门户首页。

网址结构（统一域名 + 子路径）：
  /                 门户首页
  /book/            Rust 程序设计语言
  /cargo/           Cargo 使用指南
  /reference/       Rust 参考手册
  /clippy/          Clippy 文档
  /error-codes/     Rust 错误码说明

每本书的每个 HTML：
  - </head> 前注入 Umami script.js（五本共用 website-id）
  - <body> 后注入顶部切换导航条（当前书高亮）

幂等：用标记检测，重复运行不会重复注入。
用法: python inject_site_chrome.py <rust根目录>
"""
import sys
from pathlib import Path

UMAMI_ID = "78b4825c-5f49-40aa-a5f4-48ab21744feb"
UMAMI = (f'<script defer src="https://umami.sunrise1024.top/script.js" '
         f'data-website-id="{UMAMI_ID}"></script>')

# key -> (子路径, 显示名, 简短描述)
BOOKS = [
    ("book",        "/book/",        "Rust 程序设计语言", "从入门到进阶，系统掌握 Rust 所有权、 trait、并发与异步"),
    ("cargo",       "/cargo/",       "Cargo 使用指南",   "依赖管理、工作区、命令参考与清单格式"),
    ("reference",   "/reference/",   "Rust 参考手册",     "语言语法、类型系统、语义与底层机制的权威参考"),
    ("clippy",      "/clippy/",      "Clippy 文档",       "lint 规则说明与代码改进建议"),
    ("error-codes", "/error-codes/", "Rust 错误码说明",   "编译器错误码速查，按 E0xxx 分组"),
]
BOOK_MAP = {k: (p, n, d) for k, p, n, d in BOOKS}

NAV_MARK = "<!-- RUST-SITE-NAV -->"
UMAMI_MARK = "<!-- RUST-SITE-UMAMI -->"

NAV_CSS = """<style id="rsn-css">
#rust-site-nav{position:sticky;top:0;z-index:9999;display:flex;align-items:center;gap:0;
  flex-wrap:wrap;padding:0 16px;background:#1f2937;color:#e5e7eb;
  font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  box-shadow:0 1px 4px rgba(0,0,0,.25)}
#rust-site-nav a{color:#cbd5e1;text-decoration:none;padding:11px 12px;display:inline-block;white-space:nowrap}
#rust-site-nav a:hover{color:#fff;background:rgba(255,255,255,.08)}
#rust-site-nav .rsn-brand{font-weight:700;color:#fff;padding-right:20px;margin-right:8px;
  border-right:1px solid rgba(255,255,255,.18);font-size:15px}
#rust-site-nav .rsn-active{color:#fff!important;background:rgba(249,115,22,.2);
  box-shadow:inset 0 -2px 0 #f97316;font-weight:600}
@media(max-width:720px){#rust-site-nav{padding:0 6px}#rust-site-nav a{padding:9px 7px;font-size:12px}
  #rust-site-nav .rsn-brand{padding-right:8px;margin-right:2px;font-size:13px}}
</style>"""

PORTAL_CSS = """<style>
*{box-sizing:border-box}
body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  color:#1f2937;background:#f9fafb}
.wrap{max-width:960px;margin:0 auto;padding:48px 20px}
h1{font-size:32px;margin:0 0 8px}
.sub{color:#6b7280;margin:0 0 36px}
.badge{display:inline-block;background:#fff7ed;color:#c2410c;font-size:13px;padding:4px 10px;
  border-radius:999px;margin-bottom:16px;border:1px solid #fed7aa}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.card{display:block;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:22px;
  text-decoration:none;color:inherit;transition:transform .15s,box-shadow .15s,border-color .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.08);border-color:#f97316}
.card h2{margin:0 0 8px;font-size:19px;color:#111827}
.card h2 .arrow{float:right;color:#f97316}
.card p{margin:0;color:#6b7280;font-size:14px}
footer{margin-top:48px;text-align:center;color:#9ca3af;font-size:13px}
</style>"""


def nav_html(current_key):
    links = []
    for k, path, name, _ in BOOKS:
        cls = ' class="rsn-active"' if k == current_key else ""
        links.append(f'<a href="{path}"{cls}>{name}</a>')
    return (f'{NAV_MARK}\n{NAV_CSS}\n'
            f'<div id="rust-site-nav">'
            f'<a class="rsn-brand" href="/">Rust 中文文档</a>'
            + "".join(links) + f'</div>')


def inject_book(site_dir, current_key):
    count = 0
    for f in site_dir.rglob("*.html"):
        try:
            t = f.read_text(encoding="utf-8", errors="surrogateescape")
        except Exception:
            continue
        changed = False
        # Umami：在 </head> 前
        if UMAMI_MARK not in t and UMAMI not in t:
            if "</head>" in t:
                t = t.replace("</head>", f"    {UMAMI_MARK}\n    {UMAMI}\n    </head>", 1)
                changed = True
        # 导航条：在 <body> 后
        if NAV_MARK not in t:
            idx = t.find("<body")
            if idx != -1:
                gt = t.find(">", idx)
                if gt != -1:
                    t = t[:gt + 1] + "\n" + nav_html(current_key) + t[gt + 1:]
                    changed = True
        if changed:
            f.write_text(t, encoding="utf-8", errors="surrogateescape")
            count += 1
    return count


def make_portal(root):
    cards = []
    for k, path, name, desc in BOOKS:
        cards.append(f'<a class="card" href="{path}"><h2>{name}<span class="arrow">→</span></h2>'
                     f'<p>{desc}</p></a>')
    html = f"""<!DOCTYPE HTML>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rust 中文文档</title>
{PORTAL_CSS}
    {UMAMI_MARK}
    {UMAMI}
</head>
<body>
<div class="wrap">
  <span class="badge">本地 Hy-MT2 翻译 · 持续跟进官方更新</span>
  <h1>Rust 中文文档</h1>
  <p class="sub">五本核心文档，统一导航，随处切换。点击卡片进入：</p>
  <div class="grid">
    {''.join(cards)}
  </div>
  <footer>译文仅供参考，以官方文档为准 · Umami 统计已启用</footer>
</div>
</body>
</html>"""
    (root / "index.html").write_text(html, encoding="utf-8")


def main():
    root = Path(sys.argv[1]).resolve()
    total = 0
    for key, _, _, _ in BOOKS:
        site = root / key / "site"
        if not site.exists():
            print(f"[跳过] {key}: 无 site 目录")
            continue
        n = inject_book(site, key)
        print(f"[注入] {key}: {n} 页")
        total += n
    make_portal(root)
    print(f"门户首页已生成: {root / 'index.html'}")
    print(f"共注入 {total} 页")


if __name__ == "__main__":
    main()
