#!/usr/bin/env python3
"""把生成物组装成可浏览的静态站：
- API 参考：Leafdoc 片段 → 套 HTML 外壳
- 教程：Jekyll md → 简单 HTML（保留代码/Liquid 标签显示为文本）
"""
import re, shutil
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "site-zh"
API_FRAG = ROOT / "site-build" / "reference.html"
TUT_SRC = ROOT / "translated" / "docs" / "examples"

CSS = """
:root{--c:#2c3e50;--accent:#1a9850;--bg:#fff;--code:#f5f5f5;--border:#e1e4e8}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;color:var(--c);background:var(--bg);line-height:1.7}
header{background:var(--accent);color:#fff;padding:14px 24px;display:flex;align-items:center;gap:16px}
header .ver{background:rgba(255,255,255,.2);padding:3px 10px;border-radius:12px;font-size:13px;font-weight:600}
header a{color:#fff;text-decoration:none;font-weight:600}header a:hover{text-decoration:underline}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
h1{font-size:28px;border-bottom:2px solid var(--accent);padding-bottom:8px}
h2{margin-top:36px;color:#1a9850}h3,h4{color:#2c3e50}
code{background:var(--code);padding:2px 5px;border-radius:4px;font-family:Consolas,monospace;font-size:13px}
pre{background:var(--code);padding:14px;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid var(--border);padding:8px 12px;text-align:left}
th{background:#f0f7f4}a{color:#1a9850}
.nav{background:#f8f9fa;padding:12px 24px;border-bottom:1px solid var(--border);font-size:14px}
.nav a{margin-right:18px}
"""

SHELL = """<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="/style.css">
</head><body>
<header><a href="/index.html">🍃 Leaflet 中文文档</a><span class="ver">v1.9.4 稳定版 · 中文</span></header>
<div class="nav"><a href="/index.html">首页</a><a href="/reference.html">API 参考</a><a href="/tutorials.html">教程</a></div>
<div class="wrap">{body}</div>
</body></html>"""

UMAMI = '<script defer src="https://umami.sunrise1024.top/script.js" data-website-id="252ee09e-9fd1-4687-9498-62fab5b83dd5"></script>'

def md_to_html(md, title):
    """极简 markdown → HTML：标题/段落/列表/代码块/行内代码/链接。
    Liquid 标签和 HTML 原样保留（用转义防止被当真标签）。"""
    lines = md.split("\n")
    out = []
    in_code = False
    in_ul = False
    in_fm = False
    for line in lines:
        s = line.strip()
        if s == "---" and not in_fm and not out:
            in_fm = True; continue
        if in_fm:
            if s == "---": in_fm = False
            continue
        if s.startswith("```"):
            if in_code:
                out.append("</code></pre>"); in_code = False
            else:
                out.append("<pre><code>"); in_code = True
            continue
        if in_code:
            out.append(line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            continue
        if line.startswith(("\t", "    ")):
            # 缩进代码
            out.append("<pre><code>" + line.strip().replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") + "</code></pre>")
            continue
        # Liquid / HTML 行：转义显示
        if s.startswith(("{%", "{{")):
            out.append("<p><code>" + line.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") + "</code></p>")
            continue
        m = re.match(r'^(#{1,6})\s+(.*)$', s)
        if m:
            lv = len(m.group(1)); out.append(f"<h{lv}>{inline(m.group(2))}</h{lv}>")
            continue
        m = re.match(r'^[*-]\s+(.*)$', s)
        if m:
            if not in_ul: out.append("<ul>"); in_ul = True
            out.append(f"<li>{inline(m.group(1))}</li>")
            continue
        if in_ul:
            out.append("</ul>"); in_ul = False
        if not s:
            continue
        out.append(f"<p>{inline(s)}</p>")
    if in_ul: out.append("</ul>")
    if in_code: out.append("</code></pre>")
    return "\n".join(out)

def inline(s):
    # 行内代码
    s = re.sub(r'`([^`]+)`', lambda m: "<code>" + m.group(1).replace("<","&lt;").replace(">","&gt;") + "</code>", s)
    # 链接
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    # 加粗
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    return s

def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "style.css").write_text(CSS, encoding="utf-8")

    # API 参考：去掉 Jekyll frontmatter，套外壳
    frag = API_FRAG.read_text(encoding="utf-8", errors="surrogateescape")
    frag = re.sub(r'^---\n.*?\n---\n', '', frag, count=1, flags=re.S)
    body = "<h1>Leaflet API 参考</h1>" + frag
    html = SHELL.format(title="Leaflet API 参考 · 中文", body=body).replace("</body>", UMAMI + "</body>")
    (OUT / "reference.html").write_text(html, encoding="utf-8")
    print("API 参考页已生成")

    # 教程：每个主题一个 HTML（取 */index.md 作为主教程页）
    tutorials = []
    for f in sorted(TUT_SRC.rglob("*.md")):
        rel = f.relative_to(TUT_SRC).as_posix()
        # 正文页：名字含 index.md 或顶层较短的教程（如 choropleth.md）
        if not (rel.endswith("index.md") or ("/" not in rel and not rel.endswith("-example.md"))):
            continue
        md = f.read_text(encoding="utf-8", errors="surrogateescape")
        # 提取 title
        tm = re.search(r'^title:\s*(.+)$', md, re.M)
        title = tm.group(1).strip() if tm else rel
        body = md_to_html(md, title)
        name = rel.replace("/", "_").replace(".md", ".html")
        html = SHELL.format(title=f"{title} · Leaflet 教程", body=f"<h1>{title}</h1>" + body).replace("</body>", UMAMI + "</body>")
        (OUT / name).write_text(html, encoding="utf-8")
        tutorials.append((name, title))
    print(f"教程页已生成: {len(tutorials)} 篇")

    # 教程索引页
    items = "\n".join(f'<li><a href="/{n}">{t}</a></li>' for n, t in tutorials)
    idx = SHELL.format(title="Leaflet 中文教程", body=f"<h1>教程</h1><ul>{items}</ul>").replace("</body>", UMAMI + "</body>")
    (OUT / "tutorials.html").write_text(idx, encoding="utf-8")

    # 首页
    home = SHELL.format(title="Leaflet 中文文档", body="""<h1>Leaflet 中文文档</h1>
<p>基于 Leaflet <strong>1.9.4 稳定版</strong> 官方源码翻译 · 本地 Hy-MT2-1.8B 模型生成</p>
<ul><li><a href="/reference.html">API 参考</a> — 全部类、选项、事件、方法（83 个源文件注释翻译）</li>
<li><a href="/tutorials.html">教程</a> — 快速入门、图层、GeoJSON、CRS 等</li></ul>""").replace("</body>", UMAMI + "</body>")
    (OUT / "index.html").write_text(home, encoding="utf-8")
    print(f"站点完成: {len(list(OUT.glob('*.html')))} 个 HTML")

if __name__ == "__main__":
    main()
