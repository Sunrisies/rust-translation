#!/usr/bin/env python3
"""用 Leaflet 官网外壳（header/logo/footer/CSS）+ 中文专用布局组装站点。
- 保留官网 head/header/footer 与资源，观感是官网的
- main 区域用「左侧目录 + 右侧内容」自建布局（zh.css），适配老式 Leafdoc 结构，限宽不铺满
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "site-official"
TPL = ROOT / "official-template.html"
API_FRAG = ROOT / "site-build" / "reference.html"
TUT_SRC = ROOT / "translated" / "docs" / "examples"
UMAMI = '<script defer src="https://umami.sunrise1024.top/script.js" data-website-id="252ee09e-9fd1-4687-9498-62fab5b83dd5"></script>'
BADGE = '<span class="zh-badge">v1.9.4 · 中文</span>'

def get_shell():
    html = TPL.read_text(encoding="utf-8", errors="surrogateescape")
    m = re.search(r'(<main\s*>)(.*?)(</main>)', html, re.S)
    before = html[:m.start(1)]
    after = html[m.end(3):]
    # 去掉官网的乌克兰声明弹窗 template（site.js 找不到就不弹）
    before = re.sub(r'<template id="dialog-template">.*?</template>', '', before, flags=re.S)
    after = re.sub(r'<template id="dialog-template">.*?</template>', '', after, flags=re.S)
    # 注入 zh.css（在官网 main.css 之后，覆盖它）
    before = before.replace('href="docs/css/main.css"',
                            'href="docs/css/main.css" />\n\t<link rel="stylesheet" href="docs/css/zh.css"')
    return before, after

def split_toc(frag):
    """从 Leafdoc 片段拆出 (toc_html, body_html)。"""
    i = frag.find('<div id="toc"')
    if i < 0:
        return "", frag
    # 数 div 深度找到 toc 结束
    depth = 0
    end = -1
    for m in re.finditer(r'<div\b|</div>', frag[i:]):
        if m.group(0) == '</div>':
            depth -= 1
            if depth == 0:
                end = i + m.end()
                break
        else:
            depth += 1
    toc = frag[i:end] if end > 0 else ""
    body = frag[end:] if end > 0 else frag
    # 清理 toc 里的官网 class（避免 site.js / main.css 干扰重排）
    toc = toc.replace('id="toc" class="clearfix"', 'class="zh-toc"')
    toc = re.sub(r'class="toc-col[^"]*"', '', toc)
    return toc, body

def toc_to_sidebar(toc):
    """把 toc 的 h4/ul 结构转成简洁目录（保留链接锚点）。"""
    if not toc:
        return ""
    # 已是 h4 + ul 结构，直接用；清理多余 div 包裹
    toc = re.sub(r'</?div[^>]*>', '', toc)
    return toc

def page(before, after, main_html, title, single=False, active=None):
    cls = 'zh-single' if single else 'zh-layout'
    html = before + f'<main><div class="{cls}">{main_html}</div></main>' + after
    html = re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', html, count=1)
    if UMAMI not in html:
        html = html.replace("</head>", UMAMI + "</head>")
    # 官网模板把 active 写死在 Docs，按当前页改成正确高亮
    if active:
        # 先清掉所有 active
        html = re.sub(r'(<a href="[^"]+")\s+class="active"', r'\1', html)
        # 给目标导航链接加 active
        html = re.sub(rf'(<a href="{re.escape(active)}")(?!\s+class="active")',
                      r'\1 class="active"', html, count=1)
    return html

def md_to_html(md):
    lines = md.split("\n")
    out, in_code, in_ul, in_fm = [], False, False, False
    for line in lines:
        s = line.strip()
        if s == "---" and not in_fm and not out:
            in_fm = True; continue
        if in_fm:
            if s == "---": in_fm = False
            continue
        if s.startswith("```"):
            out.append("</code></pre>" if in_code else "<pre><code>")
            in_code = not in_code; continue
        if in_code:
            out.append(line.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")); continue
        # 原始 HTML 块（table/pre/链接等）原样保留，不转义——必须在缩进代码判断之前
        if re.match(r'^</?(table|thead|tbody|tr|th|td|pre|code|div|small|b|em|a)\b', s, re.I):
            out.append(line); continue
        if line.startswith(("\t", "    ")):
            out.append("<pre><code>" + line.strip().replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") + "</code></pre>"); continue
        if s.startswith(("{%", "{{")):
            out.append("<p><code>" + line.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") + "</code></p>"); continue
        m = re.match(r'^(#{1,6})\s+(.*)$', s)
        if m:
            out.append(f"<h{len(m.group(1))}>{inline(m.group(2))}</h{len(m.group(1))}>"); continue
        m = re.match(r'^[*-]\s+(.*)$', s)
        if m:
            if not in_ul: out.append("<ul>"); in_ul = True
            out.append(f"<li>{inline(m.group(1))}</li>"); continue
        if in_ul: out.append("</ul>"); in_ul = False
        if not s: continue
        out.append(f"<p>{inline(s)}</p>")
    if in_ul: out.append("</ul>")
    if in_code: out.append("</code></pre>")
    return "\n".join(out)

def inline(s):
    s = re.sub(r'`([^`]+)`', lambda m: "<code>"+m.group(1).replace("<","&lt;").replace(">","&gt;")+"</code>", s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    return s

def main():
    before, after = get_shell()
    OUT.mkdir(exist_ok=True)

    # API 参考：拆 TOC + 正文，左目录右内容
    frag = API_FRAG.read_text(encoding="utf-8", errors="surrogateescape")
    frag = re.sub(r'^---\n.*?\n---\n', '', frag, count=1, flags=re.S)
    toc, body = split_toc(frag)
    sidebar = toc_to_sidebar(toc)
    main_html = (f'<aside class="zh-sidebar"><h4>目录</h4>{sidebar}</aside>'
                 f'<article class="zh-main"><h2>Leaflet API 参考 {BADGE}</h2>{body}</article>')
    (OUT / "reference.html").write_text(page(before, after, main_html, "API 参考 - Leaflet 中文文档", active="reference.html"), encoding="utf-8")
    print(f"API 参考页 OK (目录 {len(sidebar)} 字符)")

    # 教程
    tutorials = []
    for f in sorted(TUT_SRC.rglob("*.md")):
        rel = f.relative_to(TUT_SRC).as_posix()
        if not (rel.endswith("index.md") or ("/" not in rel and not rel.endswith("-example.md"))):
            continue
        md = f.read_text(encoding="utf-8", errors="surrogateescape")
        tm = re.search(r'^title:\s*(.+)$', md, re.M)
        title = tm.group(1).strip() if tm else rel
        body = md_to_html(md)
        name = rel.replace("/", "_").replace(".md", ".html")
        main_html = f'<h2>{title} {BADGE}</h2>' + body
        (OUT / name).write_text(page(before, after, main_html, f"{title} - Leaflet 中文文档", single=True, active="examples.html"), encoding="utf-8")
        tutorials.append((name, title))
    print(f"教程页 OK: {len(tutorials)}")

    items = "\n".join(f'<li><a href="{n}">{t}</a></li>' for n, t in tutorials)

    # 导航页（官网同名文件，导航链接自动对上）：
    # index=Overview, examples=Tutorials, install=Install；plugins 保留官网英文（不生成）
    nav_dir = ROOT / "nav-translated"
    def nav_body(name, fallback):
        p = nav_dir / name
        if p.exists():
            txt = p.read_text(encoding="utf-8", errors="surrogateescape")
            txt = re.sub(r'^---\n.*?\n---\n', '', txt, count=1, flags=re.S)
            # .md 文件走 markdown → HTML 渲染；.html 片段已是 HTML 直接用
            if p.suffix == '.md':
                txt = md_to_html(txt)
            # 导航页译文是精简的文本段落，说明来源
            return f'<p style="color:#888;font-size:13px;">（本篇为中文翻译，基于 Leaflet 1.9.4）</p>' + txt
        return fallback

    # Tutorials (examples.html)：用带本地链接的教程索引（若无则回退）
    tl = nav_dir / "tutorials-linked.html"
    tut_nav = (tl.read_text(encoding="utf-8", errors="surrogateescape") if tl.exists()
               else nav_body("tutorials.html", f'<h2>Leaflet 1.9 教程</h2><ul>{items}</ul>'))
    (OUT / "examples.html").write_text(
        page(before, after, tut_nav, "教程 - Leaflet 中文文档", single=True, active="examples.html"), encoding="utf-8")
    # 兼容旧链接
    (OUT / "tutorials.html").write_text(
        page(before, after, tut_nav, "教程 - Leaflet 中文文档", single=True, active="examples.html"), encoding="utf-8")

    # Install (install.html)：用 1.9.4 的 download.md 译文
    install_nav = nav_body("install.md", '<h2>安装 Leaflet</h2>')
    (OUT / "install.html").write_text(
        page(before, after, install_nav, "安装 - Leaflet 中文文档", single=True, active="install.html"), encoding="utf-8")

    # Overview (index.html)：优先用「官网完整 HTML 精准译文」——保留地图/公告/图片/所有结构
    full_home = nav_dir / "index-full.html"
    if full_home.exists():
        home = full_home.read_text(encoding="utf-8", errors="surrogateescape")
        # 去掉官网弹窗 template
        home = re.sub(r'<template id="dialog-template">.*?</template>', '', home, flags=re.S)
        # 标题改中文
        home = re.sub(r'<title>[^<]*</title>', '<title>Leaflet 中文文档 · 1.9.4</title>', home, count=1)
        # 注入 umami
        if UMAMI not in home:
            home = home.replace("</head>", UMAMI + "</head>")
        # 顶部导航高亮 Overview
        home = re.sub(r'(<a href="[^"]+")\s+class="active"', r'\1', home)
        home = home.replace('<a href="index.html">Overview</a>',
                            '<a href="index.html" class="active">Overview</a>', 1)
        # 在 main 的 container 顶部加中文站入口卡片 + 版本徽章
        extra = f'''<div style="background:#f3f8f5;border-left:3px solid #1a9850;padding:10px 14px;margin:0 0 18px;">
<strong>本中文站：</strong><a href="reference.html">API 参考</a> · <a href="examples.html">教程（{len(tutorials)} 篇）</a> · <a href="install.html">安装说明</a>
<span class="zh-badge">v1.9.4 · 中文</span></div>'''
        home = re.sub(r'(<main[^>]*>\s*<div class="container">)', r'\1\n' + extra, home, count=1)
        (OUT / "index.html").write_text(home, encoding="utf-8")
    else:
        overview = nav_body("index.html", '')
        home_extra = f'''<div style="background:#f3f8f5;border-left:3px solid #1a9850;padding:12px 16px;margin:16px 0;">
<strong>本中文站导航：</strong>
<a href="reference.html">API 参考</a> · <a href="examples.html">教程（{len(tutorials)} 篇）</a> · <a href="install.html">安装说明</a>
<br><small>基于 Leaflet 1.9.4 稳定版 · 本地 Hy-MT2-1.8B 模型翻译</small></div>'''
        (OUT / "index.html").write_text(
            page(before, after, overview + home_extra, "Leaflet 中文文档", single=True, active="index.html"), encoding="utf-8")
    # Plugins (plugins.html)：清单太大暂未翻译，做成跳转到官网英文页
    plugins_jump = '''<h2>插件列表</h2><p>插件清单（数百个插件）暂未翻译，即将跳转到 Leaflet 官网英文页面…</p>
<script>location.replace('https://leafletjs.com/plugins.html');</script>
<p>如果没有自动跳转，请点击 <a href="https://leafletjs.com/plugins.html">这里</a>。</p>'''
    (OUT / "plugins.html").write_text(
        page(before, after, plugins_jump, "插件列表 - Leaflet 中文文档", single=True, active="plugins.html"), encoding="utf-8")

    print(f"导航页 OK: index / examples / install / plugins(跳转官网)")
    print(f"站点完成: {len(list(OUT.glob('*.html')))} HTML")

if __name__ == "__main__":
    main()
