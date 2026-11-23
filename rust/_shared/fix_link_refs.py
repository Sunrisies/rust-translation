#!/usr/bin/env python3
"""修复 markdown 引用式链接（reference-style links）被翻译破坏的问题。

翻译器的破坏：
1. 末尾 [label]: url 定义区被合并成一行、label 译成中文、url 里 struct/enum/match
   被术语替换 -> 从源文件原样重建定义区。
2. 正文 [text][label] 的 label 被误译成中文 -> 按段落把译文 label 映射回源 label。

段落级配对：源/译文按空行分段，逐段提取 ][label] 序列，按顺序配对（翻译不改变
段内引用顺序，偶尔省略也不影响已保留项的前后对应）。

用法: python fix_link_refs.py <项目目录>
"""
import re, sys
from pathlib import Path

# 支持可选的引号 title：[label]: url "title text"（英文冒号）
DEF_RE = re.compile(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"[^"]*")?\s*$', re.MULTILINE)
# 定义行：中英文冒号都算，且冒号后紧跟 URL（含 / 或 .），避免误判正文的中文冒号
DEF_LINE_RE = re.compile(r'^\[([^\]]+)\][:：]\s*\S*(?:\.html|\.md|/|https?://|#)')
USE_RE = re.compile(r'\]\[([^\]]+)\]')


def fix_one(src_path, dst_path):
    src = src_path.read_text(encoding="utf-8", errors="surrogateescape")
    dst = dst_path.read_text(encoding="utf-8", errors="surrogateescape")
    defs = [(m.group(1), m.group(2)) for m in DEF_RE.finditer(src)]
    # 源文件里原始定义行（含可选 title），用于兜底写回
    src_def_lines = [l.rstrip() for l in src.split("\n") if DEF_LINE_RE.match(l.strip()) and not l.strip().startswith("- ")]
    # 只要源或译文任一方有定义就处理
    has_dst_def = any(DEF_LINE_RE.match(l.strip()) and not l.strip().startswith("- ") for l in dst.split("\n"))
    if not defs and not has_dst_def:
        return None
    en_labels = {lab for lab, _ in defs}

    # ---------- 1. 重建定义区 ----------
    lines = dst.split("\n")
    # 定义区特征行：行首是 [label]:，可能是多个定义被合并到一行。
    # 用正则从这些行里拆出每个 [label]: url "title" 片段。
    DEF_ITEM_RE = re.compile(r'\[([^\]]+)\][:：]\s*(\S+?)(?=\s*\[[^\]]+\][:：]|$)')
    def_items = []       # 从译文提取的 (label, 完整片段)
    kept = []
    for l in lines:
        s = l.strip()
        if DEF_LINE_RE.match(s) and not s.startswith("- "):
            # 这行是定义区（可能合并了多个），拆成单项
            for m in DEF_ITEM_RE.finditer(s):
                item = m.group(0).strip()
                def_items.append((m.group(1), item))
            continue
        kept.append(l)
    while kept and not kept[-1].strip():
        kept.pop()
    # 优先用源文件定义行（英文 label，规范）；源文件没有才用译文拆出的
    if src_def_lines:
        def_lines_out = src_def_lines
    else:
        def_lines_out = [item for _, item in def_items]
    dst = "\n".join(kept) + "\n\n" + "\n".join(def_lines_out) + "\n"

    # ---------- 2. 修正正文里与定义对不上的 label ----------
    body = "\n".join(kept)
    # 写回的定义 label 集合（来自源文件或译文）
    out_def_labels = {m.group(1) for l in def_lines_out for m in [DEF_LINE_RE.match(l)] if m}
    dst_def_labels = out_def_labels or en_labels
    src_uses = [u for u in USE_RE.findall(src) if u in en_labels]
    dst_uses = USE_RE.findall(body)
    label_map = {}
    # 译文正文里：凡是 label 不在译文定义集合中的，就是被误译的，需映射回
    # 源文件对应位置的英文 label（用单调锚点对齐）。
    si = 0
    for dlab in dst_uses:
        if dlab in dst_def_labels:
            # 已是合法 label（在译文定义里），跳过；若为英文也推进源锚点
            if dlab in en_labels:
                for j in range(si, len(src_uses)):
                    if src_uses[j] == dlab:
                        si = j + 1
                        break
            continue
        if si < len(src_uses) and dlab not in label_map:
            label_map[dlab] = src_uses[si]
            si += 1
    # 保守校验：只映射纯中文 label（无 ASCII/标点），避免解析噪声造成错误链接
    def is_pure_cn(s):
        return bool(re.search(r'[\u4e00-\u9fff]', s)) and not re.search(r'[A-Za-z0-9!.\-_{}\[\]]', s)
    label_map = {k: v for k, v in label_map.items() if is_pure_cn(k)}

    def repl(m):
        lab = m.group(1)
        return f"][{label_map[lab]}]" if lab in label_map else m.group(0)
    body = USE_RE.sub(repl, body)

    final = body + "\n\n" + "\n".join(def_lines_out) + "\n"
    changed = final != dst_path.read_text(encoding="utf-8", errors="surrogateescape")
    if changed:
        dst_path.write_text(final, encoding="utf-8", errors="surrogateescape")
    return len(defs), label_map, changed


def main():
    root = Path(sys.argv[1]).resolve()
    src_root = root / "repo/src"
    dst_root = root / "content"
    total = 0
    for src in sorted(src_root.rglob("*.md")):
        dst = dst_root / src.relative_to(src_root)
        if not dst.exists():
            continue
        r = fix_one(src, dst)
        if r:
            total += r[0]
    print(f"修复完成: 恢复 {total} 条引用定义")


if __name__ == "__main__":
    main()
