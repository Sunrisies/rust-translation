#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复译文里 JSDoc 类型表达式 {@type} 内被误翻译的词（如 undefined->未定义）。

类型表达式里的英文关键字必须保持英文，否则 JSDoc 解析失败。
"""
import re
from pathlib import Path

OUT = Path("D:/hy-mt2-bench/cesium-docs/translated")

# 类型表达式内不应出现的中文（模型误译）-> 正确英文
BAD = {
    "未定义": "undefined",
    "布尔值": "boolean",
    "字符串": "string",
    "数字": "number",
    "对象": "object",
    "数组": "Array",
    "空": "null",
    "真": "true",
    "假": "false",
}

def fix_line(line):
    # 标签行 @xxx {...}：类型区域可能嵌套花括号，直接在该行做词替换
    # （描述文字在类型之后，模型对描述里的中文是对的，但类型关键字应为英文）
    if not re.search(r"@(param|returns|property|typedef|type)\s*\{", line):
        return line
    # 找到花括号区域：从第一个 { 到与之匹配的 }（处理嵌套）
    i = line.find("{")
    if i < 0:
        return line
    depth = 0
    j = i
    while j < len(line):
        if line[j] == "{": depth += 1
        elif line[j] == "}":
            depth -= 1
            if depth == 0: break
        j += 1
    region = line[i:j+1]
    new_region = region
    for zh, en in BAD.items():
        new_region = new_region.replace(zh, en)
    return line[:i] + new_region + line[j+1:]

def main():
    fixed = 0
    for f in OUT.rglob("*.js"):
        txt = f.read_text(encoding="utf-8", errors="surrogateescape")
        if not any(zh in txt for zh in BAD):
            continue
        lines = txt.split("\n")
        changed = False
        for i, line in enumerate(lines):
            new = fix_line(line)
            if new != line:
                lines[i] = new
                changed = True
        if changed:
            f.write_text("\n".join(lines), encoding="utf-8", errors="surrogateescape")
            fixed += 1
            print("修复:", f.relative_to(OUT))
    print(f"\n共修复 {fixed} 个文件")

if __name__ == "__main__":
    main()
