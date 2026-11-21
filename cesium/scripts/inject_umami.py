#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给生成的 API 站每个 HTML 注入 Umami 统计脚本（Cesium 专用 website-id）。"""
from pathlib import Path

SITE = Path("D:/hy-mt2-bench/cesium-docs/site-final")
SNIPPET = '<script defer src="https://umami.sunrise1024.top/script.js" data-website-id="252ee09e-9fd1-4687-9498-62fab5b83dd5"></script>'

def main():
    n = 0
    for f in SITE.rglob("*.html"):
        txt = f.read_text(encoding="utf-8", errors="surrogateescape")
        if "umami.sunrise1024.top" in txt:
            continue
        if "</head>" in txt:
            txt = txt.replace("</head>", f"  {SNIPPET}\n</head>", 1)
        else:
            txt = SNIPPET + "\n" + txt
        f.write_text(txt, encoding="utf-8", errors="surrogateescape")
        n += 1
    print(f"已注入 {n} 个页面")

if __name__ == "__main__":
    main()
