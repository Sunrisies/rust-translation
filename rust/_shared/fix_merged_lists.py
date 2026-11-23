#!/usr/bin/env python3
"""拆分译文中被错误合并到一行的相邻列表项。

翻译器旧版本把连续列表项 join 成一段，译文出现 "* A。* B。* C" 这样的合并行。
本脚本在句末标点后的列表标记处重新断行，恢复列表结构。

用法: python fix_merged_lists.py <项目目录>
"""
import re, sys
from pathlib import Path

# 句末标点（中英文）后紧跟列表标记 → 断行
SPLIT = re.compile(r'(?<=[。！？；.!?;：:])\s*(?=[-*+]\s|\d+\.\s)')
LIST_START = re.compile(r'^\s*[-*+]\s|^\s*\d+\.\s')


def fix_file(p):
    lines = p.read_text(encoding="utf-8", errors="surrogateescape").split("\n")
    out = []
    changed = 0
    for line in lines:
        if LIST_START.match(line):
            parts = SPLIT.split(line)
            parts = [x for x in parts if x.strip()]
            if len(parts) > 1:
                out.extend(parts)
                changed += len(parts) - 1
                continue
        out.append(line)
    if changed:
        p.write_text("\n".join(out), encoding="utf-8", errors="surrogateescape")
    return changed


def main():
    root = Path(sys.argv[1]).resolve()
    content = root / "content"
    total = files = 0
    for f in sorted(content.rglob("*.md")):
        n = fix_file(f)
        if n:
            files += 1
            total += n
    print(f"拆分完成: {files} 个文件, {total} 处列表项恢复独立行")


if __name__ == "__main__":
    main()
