#!/usr/bin/env python3
"""处理 The Reference 特有的 r[xxx] 标记：
官方用 mdbook-spec 预处理器把它们转成隐藏锚点，我们没有该预处理器，
所以直接后处理译文：
- 行首 `r[path] # 标题` → `<a id="path"></a>\n\n# 标题`（锚点保留、标记隐藏）
- 行首 `r[path] 正文` → `<a id="path"></a> 正文`（内联锚点）
- 恢复被误翻的中文 footnote 标签（[^不安全-2024] → 英文原标签）
用法: python fix_reference_markers.py rust/reference
"""
import re, sys
from pathlib import Path

# 误翻的 footnote 标签映射（翻译时把标签名也翻了）
FOOTNOTE_FIX = {
    "不安全-2024": "unsafe-2024",
    "异步-edition": "async-edition",
}

def main():
    proj = Path(sys.argv[1]).resolve()
    content = proj / "content"
    changed = 0
    for f in content.rglob("*.md"):
        txt = f.read_text(encoding="utf-8", errors="surrogateescape")
        orig = txt
        lines = txt.split("\n")
        out = []
        for line in lines:
            m = re.match(r'^r\[([^\]]+)\]\s*(.*)$', line)
            if m:
                anchor, rest = m.group(1), m.group(2)
                # 标题行：锚点单独一行，标题保留 markdown 标记
                if re.match(r'^#{1,6}\s+', rest):
                    out.append(f'<a id="{anchor}"></a>')
                    out.append(rest)
                else:
                    # 正文行：内联锚点（不可见）
                    out.append(f'<a id="{anchor}"></a> {rest}')
            else:
                out.append(line)
        txt = "\n".join(out)
        # 恢复 footnote 标签
        for zh, en in FOOTNOTE_FIX.items():
            txt = txt.replace(f"[^{zh}]", f"[^{en}]")
        if txt != orig:
            f.write_text(txt, encoding="utf-8", errors="surrogateescape")
            changed += 1
    print(f"处理完成: {changed} 个文件")
    # 验证
    left = sum(1 for f in content.rglob('*.md') if re.search(r'^r\[', f.read_text(encoding='utf-8', errors='ignore'), re.M))
    print(f"残留 r[] 标记文件: {left}")

if __name__ == "__main__": main()
