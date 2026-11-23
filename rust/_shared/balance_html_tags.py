#!/usr/bin/env python3
"""兜底修复：让每个 <dd class="option-desc"> 块内的 <p> 与 </p> 数量平衡。

翻译后个别复杂块（含多个 <p> 段落）会多出或缺失 </p>，导致 mdbook 崩溃。
本脚本按 <dd> 块逐个校正：统计块内 <p>/</p>，多余的删掉行尾的，缺失的补在行尾。

用法: python balance_html_tags.py <cargo项目目录>
"""
import re, sys
from pathlib import Path

DD_BLOCK = re.compile(r'(<dd class="option-desc">)(.*?)(</dd>)', re.DOTALL)


def fix_block(m):
    head, body, tail = m.group(1), m.group(2), m.group(3)
    op = len(re.findall(r'<p>', body))
    cl = len(re.findall(r'</p>', body))
    if op == cl:
        return m.group(0)
    if cl > op:
        # 多余的 </p>：从 body 末尾往前删除 extra 个
        extra = cl - op
        for _ in range(extra):
            idx = body.rfind('</p>')
            if idx == -1:
                break
            body = body[:idx] + body[idx + 4:]
    else:
        # 缺失的 </p>：补到 body 末尾
        body = body.rstrip() + '</p>' * (op - cl)
    return head + body + tail


def main():
    root = Path(sys.argv[1]).resolve()
    content = root / "content/commands"
    files = fixed = 0
    for f in sorted(content.glob("*.md")):
        t = f.read_text(encoding="utf-8", errors="surrogateescape")
        new = DD_BLOCK.sub(fix_block, t)
        if new != t:
            f.write_text(new, encoding="utf-8", errors="surrogateescape")
            files += 1
    # 全局复查
    bad = []
    for f in (root / "content").rglob("*.md"):
        t = f.read_text(encoding="utf-8", errors="surrogateescape")
        if f.name != "CHANGELOG.md" and len(re.findall(r'<p>', t)) != len(re.findall(r'</p>', t)):
            bad.append(f.name)
    print(f"修复 {files} 个文件; 全局仍不平衡: {len(bad)} 个 {bad[:5]}")


if __name__ == "__main__":
    main()
