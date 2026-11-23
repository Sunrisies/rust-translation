#!/usr/bin/env python3
"""重译 Cargo 命令文档，彻底修复 <dd><p>...</p></dd> 的 </p> 丢失问题。

策略：
1. 从源文件读取，把每个 <dd class="option-desc"><p>...</p></dd> 块替换为占位符
2. 用翻译器翻译占位符之外的正文（代码块/标签天然受保护）
3. 单独精确翻译每个 dd 块的 <p> 内文字（保留 HTML 内联标签）
4. 还原占位符为结构完整的 dd 块

用法: python fix_html_options.py <cargo项目目录>
"""
import re, sys
from pathlib import Path
import md_translator as mt

DD = re.compile(r'<dd class="option-desc"><p>(.*?)</p>\s*</dd>', re.DOTALL)

SYS_DD = """你是技术文档翻译引擎。把用户给出的每段英文技术文档翻译成简体中文。
每段用 <##数字> 标记开头，必须为每段输出译文并保留同样的标记，一段不漏。
硬性规则：
1. 保留段中所有 HTML 标签（如 <a href="...">、</a>、<code>、</code>、<em>、</em>）及属性原样，不翻译、不删除、不改动。
2. 保留 `代码`、**加粗**、[链接文字](url)；url 不翻译，链接文字可翻译。
3. 命令名、选项名、参数名、SPEC、glob 等技术术语保持英文原样。
4. 只输出带 <##数字> 标记的译文，不要输出原文、注释或解释。
"""


def process(src_path, dst_path, cfg, sys_main):
    src = src_path.read_text(encoding="utf-8", errors="surrogateescape")
    dds = list(DD.finditer(src))
    if not dds:
        return 0

    # 1. 用占位符替换 dd 块
    ph = {}
    masked = src
    for i in range(len(dds) - 1, -1, -1):
        m = dds[i]
        token = f"<!--DDPLACEHOLDER{i}-->"
        ph[token] = m.group(1)  # <p> 内原文
        masked = masked[:m.start()] + token + masked[m.end():]

    # 2. 翻译占位符之外的正文
    tmp = dst_path.parent / (dst_path.name + ".tmp")
    tmp.write_text(masked, encoding="utf-8", errors="surrogateescape")
    mt.translate_file(tmp, tmp, cfg, sys_main)

    # 3. 单独翻译每个 dd 块的 <p> 内文字
    segs = [(i, ph[f"<!--DDPLACEHOLDER{i}-->"]) for i in range(len(dds))]
    trans = mt.call_llm(segs, SYS_DD)

    # 4. 还原占位符为完整 dd 块
    text = tmp.read_text(encoding="utf-8", errors="surrogateescape")
    for i in range(len(dds)):
        token = f"<!--DDPLACEHOLDER{i}-->"
        inner = trans.get(i, ph[token]).strip()
        text = text.replace(token, f'<dd class="option-desc"><p>{inner}</p>\n</dd>')
    dst_path.write_text(text, encoding="utf-8", errors="surrogateescape")
    tmp.unlink(missing_ok=True)
    return len(dds)


def main():
    root = Path(sys.argv[1]).resolve()
    cfg = mt.load_cfg(root)
    sys_main = mt.SYS_TMPL.format(terms_list=", ".join(sorted(cfg["terms"])[:14]))
    src_dir = root / "repo/src/commands"
    dst_dir = root / "content/commands"
    files = sorted(src_dir.glob("*.md"))
    total = 0
    for i, src in enumerate(files, 1):
        dst = dst_dir / src.name
        if not dst.exists():
            continue
        n = process(src, dst, cfg, sys_main)
        total += n
        print(f"[{i}/{len(files)}] {src.name}: {n} 块", flush=True)
    print(f"完成: 共 {total} 个选项块", flush=True)


if __name__ == "__main__":
    main()
