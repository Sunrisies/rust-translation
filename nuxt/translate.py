#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Nuxt docs markdown translator using local Hy-MT2-1.8B.

Preserves structure: frontmatter keys, code fences, MDC component lines
(::tip, ::card, :read-more, etc.), inline code, links, paths, tech terms.
Only translates natural-language prose.
"""
import sys, json, re, urllib.request, hashlib
from pathlib import Path

BASE = Path("D:/hy-mt2-bench/nuxt-docs/repo/docs")   # 英文源（仓库根）
OUT = Path("D:/hy-mt2-bench/nuxt-docs/nuxt/site/content")  # 译文输出
API = "http://127.0.0.1:8999/v1/chat/completions"

SYS = (
    "你是专业的技术文档翻译引擎。把用户给出的每一段英文技术文档翻译成简体中文。\n"
    "硬性规则：\n"
    "1. 输入包含多个用 <##数字> 开头标记的段落，你必须为每一段输出译文，并保留同样的 <##数字> 标记，顺序不变，一段不漏。\n"
    "2. 绝对不要修改、翻译或删除任何 Markdown / MDC 标记：**加粗**、`行内代码`、[链接文本](url)、:read-more{...}、::组件名。链接文本可译，url 和花括号内属性原样保留。\n"
    "3. `行内代码`、文件路径、目录名（如 app/pages/）、组件名（NuxtPage）、命令、代码、技术术语（SSR、HMR、TypeScript、Vite、Nitro、tree-shaking）保持原样不译。\n"
    "4. 不要增删信息，不要加解释，不要合并或拆分段落。只输出译文，不要输出原文或评论。\n"
)

def call_llm(blocks):
    """blocks: list of (idx, text). Returns dict idx->translated."""
    parts = [f"<##{i}>\n{t}" for i, t in blocks]
    user = "\n\n".join(parts)
    payload = json.dumps({
        "messages": [{"role": "system", "content": SYS},
                     {"role": "user", "content": user}],
        "temperature": 0.1, "top_k": 50, "repeat_penalty": 1.05,
        "max_tokens": 4096,
    }).encode("utf-8")
    req = urllib.request.Request(API, data=payload,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.loads(r.read())
    text = data["choices"][0]["message"]["content"]
    # split back by markers
    out = {}
    cur = None
    for line in text.split("\n"):
        m = re.match(r"\s*<##(\d+)>\s*$", line)
        if m:
            cur = int(m.group(1)); out[cur] = []
            continue
        m2 = re.match(r"\s*<##(\d+)>\s*(.*)$", line)
        if m2:
            cur = int(m2.group(1)); out[cur] = [m2.group(2)]
            continue
        if cur is not None:
            out[cur].append(line)
    return {k: "\n".join(v).strip() for k, v in out.items()}, text

def translate_md(src: Path, dst: Path, cache: dict, cache_path: Path):
    lines = src.read_text(encoding="utf-8").split("\n")
    out_lines = []
    translatable = []  # (out_index, text)
    i = 0
    in_code = False
    # first: frontmatter
    # detect frontmatter
    fm_end = None
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() == "---":
                fm_end = j; break
    fm_range = (0, fm_end) if fm_end is not None else None

    for idx, line in enumerate(lines):
        stripped = line.strip()
        # toggle code fence
        if stripped.startswith("```"):
            in_code = not in_code
            out_lines.append(line); continue
        if in_code:
            out_lines.append(line); continue
        # skip MDC component lines and comments
        if (not stripped or stripped.startswith("::") or stripped.startswith(":")
                or stripped.startswith("![") or stripped.startswith("<!--")
                or stripped.startswith("---") and idx == (fm_range[1] if fm_range else -1)):
            out_lines.append(line); continue
        # frontmatter: translate only title/description values
        if fm_range and fm_range[0] <= idx <= fm_range[1]:
            m = re.match(r"^(title|description):\s*(.+)$", line)
            if m:
                translatable.append((idx, m.group(2).strip().strip("'\"")))
                out_lines.append(line)  # placeholder, replaced later
            else:
                out_lines.append(line)
            continue
        # normal prose (headings, list items, paragraphs)
        if re.search(r"[A-Za-z]", line):
            translatable.append((idx, line))
            out_lines.append(line)
        else:
            out_lines.append(line)

    # batch translate in groups to keep request size sane
    groups = []
    cur = []
    size = 0
    for item in translatable:
        size += len(item[1])
        cur.append(item)
        if size > 2500:
            groups.append(cur); cur = []; size = 0
    if cur: groups.append(cur)

    translations = {}
    for g in groups:
        idx_map = {out_i: t for out_i, t in g}
        res, raw = call_llm([(str(k), v) for k, v in idx_map.items()])
        for k, v in res.items():
            translations[int(k)] = v
        print(f"  translated group of {len(g)} blocks", file=sys.stderr)

    # apply translations
    for out_i, txt in translations.items():
        line = lines[out_i]
        if fm_range and fm_range[0] <= out_i <= fm_range[1]:
            m = re.match(r"^(title|description):\s*(.+)$", line)
            if m:
                quote = '"' if txt and any(c in txt for c in ":#'\"") else ""
                out_lines[out_i] = f"{m.group(1)}: {txt}"
            continue
        # preserve leading heading/list/quote markers
        m = re.match(r"^(\s*(?:[-*]\s+|#{1,6}\s+|>\s+)?)", line)
        prefix = m.group(1) if m else ""
        body = txt.lstrip()
        # strip any duplicate markers the model may have echoed
        body = re.sub(r"^(?:#{1,6}|[-*>+])\s+", "", body)
        out_lines[out_i] = prefix + body

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text("\n".join(out_lines), encoding="utf-8")
    return len(translations)

def main():
    files = [
        "1.getting-started/01.introduction.md",
        "1.getting-started/02.installation.md",
        "1.getting-started/04.views.md",
    ]
    for f in files:
        src = BASE / f
        dst = OUT / f
        print(f"== {f} ==", file=sys.stderr)
        n = translate_md(src, dst, {}, None)
        print(f"  done, {n} blocks translated -> {dst}", file=sys.stderr)

if __name__ == "__main__":
    main()
