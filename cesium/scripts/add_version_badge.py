#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给 Cesium API 站每个页面加版本标识（在 page-title 标题后）。"""
from pathlib import Path

SITE = Path("D:/hy-mt2-bench/cesium-docs/site-final2")
# 版本徽章 HTML：轻量样式，和 JSDoc 默认主题协调
BADGE = ('<span style="display:inline-block;margin-left:14px;padding:3px 10px;'
         'font-size:13px;font-weight:600;color:#fff;background:#00a97f;'
         'border-radius:12px;vertical-align:middle;">Cesium v1.147 · 中文</span>')

def main():
    n = 0
    for f in SITE.rglob("*.html"):
        txt = f.read_text(encoding="utf-8", errors="surrogateescape")
        if "Cesium v1.140 · 中文" in txt:
            continue
        # 修正生成时传错的版本号（源码链接）
        txt = txt.replace("1.140.0", "1.147.0")
        # 在 page-title 的 </h1> 前插入徽章
        marker = '<h1 class="page-title">'
        idx = txt.find(marker)
        if idx < 0:
            f.write_text(txt, encoding="utf-8", errors="surrogateescape")
            continue
        end = txt.find("</h1>", idx)
        if end < 0:
            f.write_text(txt, encoding="utf-8", errors="surrogateescape")
            continue
        txt = txt[:end] + BADGE + txt[end:]
        f.write_text(txt, encoding="utf-8", errors="surrogateescape")
        n += 1
    print(f"已在 {n} 个页面添加版本标识")

if __name__ == "__main__":
    main()
