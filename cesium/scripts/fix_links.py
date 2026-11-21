#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复 JSDoc {@link Xxx} 被误翻译的问题。

规则：逐行对照源文件与译文。若译文行的 link 结构被破坏（link 内含中文、
或 link 数量/目标与源不一致），则该行回退为英文原文——宁可不译，不能结构错乱。
另外修复 @typedef/@callback 的类型名被翻译成中文（如 Destroyable -> 可销毁）。
"""
import re
from pathlib import Path

ROOT = Path("D:/hy-mt2-bench/cesium-docs")
SRC, OUT = ROOT / "repo", ROOT / "translated"

LINK = re.compile(r"\{@link\s+([^}]*)\}")

def links_of(line):
    return [m.group(1).strip() for m in LINK.finditer(line)]

def is_identifier(s):
    # 合法 link 目标：ClassName / ClassName#member / 中文以外
    return bool(s) and not re.search(r"[一-龥]", s) and re.match(r"^[A-Za-z_$][\w$.#-]*", s)

def main():
    fixed = 0
    for sf in SRC.rglob("*.js"):
        rel = sf.relative_to(SRC)
        of = OUT / rel
        if not of.exists():
            continue
        sa = sf.read_text(encoding="utf-8", errors="surrogateescape").splitlines()
        ob = of.read_text(encoding="utf-8", errors="surrogateescape").splitlines()
        if len(sa) != len(ob):
            continue
        changed = False
        for i, (src_line, out_line) in enumerate(zip(sa, ob)):
            need_fix = False
            # 1) link 目标被翻译成中文 / 结构混乱
            src_links = links_of(src_line)
            out_links = links_of(out_line)
            if src_links:
                # 译文 link 数不对，或任一目标是中文/非标识符
                if len(src_links) != len(out_links) or any(not is_identifier(x) for x in out_links):
                    need_fix = True
            # 2) @typedef/@callback 的类型名被翻成中文（行内出现 中文 紧跟在 } 后）
            if re.search(r"@(typedef|callback)\s+\{[^}]*\}\s*[一-龥]", out_line):
                need_fix = True
            # 3) 描述里残留 <##n>
            if "<##" in out_line:
                need_fix = True
            if need_fix:
                ob[i] = src_line  # 回退为英文原文，保证结构正确
                changed = True
        if changed:
            of.write_text("\n".join(ob), encoding="utf-8", errors="surrogateescape")
            fixed += 1
            print("修复:", rel)
    print(f"\n共修复 {fixed} 个文件")

if __name__ == "__main__":
    main()
