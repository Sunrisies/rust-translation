#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cesium JSDoc 注释增量翻译器（Hy-MT2-1.8B 本地模型）

只翻译 /** ... */ 注释里的自然语言描述，绝不改动代码、类型、标签、参数名、示例。

特性：
1. SHA256 内容哈希缓存，只翻变化的文件（断点续传）
2. 精确解析 JSDoc：标签前缀（@param {type} name）原样保留，只翻描述
3. 保护代码标记：<code>、{@link}、反引号、`|` 类型、HTML 标签原样
4. Cesium 术语表统一
5. 保留源文件编码/换行

用法：
  python jsdoc_translator.py --stats                     # 统计
  python jsdoc_translator.py --file <相对路径>            # 翻译单个
  python jsdoc_translator.py --limit 10                   # 先翻10个测试
  python jsdoc_translator.py --all                        # 全部 985 个
  python jsdoc_translator.py --all --force                # 强制重翻
"""
import sys, json, re, urllib.request, hashlib, argparse, time
from pathlib import Path

ROOT     = Path("D:/hy-mt2-bench/cesium-docs")
SRC      = ROOT / "repo"                    # 最新源码（只读，保留英文原文）
OUT      = ROOT / "translated"              # 译文输出（改了注释的 js）
CACHE    = ROOT / "cache.json"
API      = "http://127.0.0.1:8999/v1/chat/completions"

# Cesium 专有术语：保持英文（这些是类名/概念名，官方中文圈习惯保留）
KEEP_EN = {
    "Cesium", "CesiumJS", "Viewer", "Camera", "Entity", "Primitive", "Scene",
    "Terrain", "Imagery", "DataSource", "Cartesian3", " JulianDate", "Ellipsoid",
    "3D Tiles", "glTF", "WebGL", "WGS84", "ion", "Sandcastle",
}
# 需要统一翻译的短语
TERMS = {
    "widget": "控件", "widgets": "控件",
    "imagery layer": "影像图层", "imagery provider": "影像提供程序",
    "terrain provider": "地形提供程序",
    "data source": "数据源", "entity": "实体", "entities": "实体",
}

SYS = (
    "你是专业的技术文档翻译引擎，把 JSDoc 注释里的英文描述翻译成简体中文。\n"
    "输入是多段用 <##数字> 标记的文本，逐段翻译，输出保留同样的标记，一段不漏、顺序不变。\n"
    "硬性规则：\n"
    "1. 只输出译文本身，不要原文、不要解释、不要加引号。\n"
    "2. 以下内容绝对原样保留，不翻译、不修改：\n"
    "   - <code>...</code>、{@link ...}、反引号 `...` 内的内容\n"
    "   - 英文参数名、函数名、类名、类型名（Cesium/Viewer/Camera/Entity/Cartesian3 等）\n"
    "   - 数字、单位、布尔值 true/false\n"
    "3. 技术术语统一：widget→控件，imagery layer→影像图层，entity→实体。\n"
    "4. 保持简洁，符合中文技术文档表达习惯。\n"
)

# 行首的 JSDoc 星号前缀，形如 " * "
STAR = re.compile(r"^(\s*\*\s?)(.*)$")
# 标签行：@param {type} [name=default] 描述  /  @returns {type} 描述
TAG_LINE = re.compile(r"^(@\w+)\s+(\{[^}]*\})?\s*(\[[^\]]*\]|\S+)?\s*(.*)$")
# 保护片段：<code>x</code>、{@link x}、`x`
PROTECT = re.compile(r"(<code>.*?</code>|\{@link[^}]*\}|`[^`]*`)")

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def split_protected(text):
    """把文本切成 [普通段, 保护段, 普通段, ...]，只翻译偶数下标"""
    parts = PROTECT.split(text)
    return parts

def call_llm(blocks, retries=3):
    """blocks: [(idx, text)] -> {idx: translated}"""
    payload = json.dumps({
        "messages": [
            {"role": "system", "content": SYS},
            {"role": "user", "content": "\n\n".join(f"<##{i}>\n{t}" for i, t in blocks)},
        ],
        "temperature": 0.1, "top_k": 50, "repeat_penalty": 1.05,
        "max_tokens": 4096,
    }).encode("utf-8")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API, data=payload,
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.loads(r.read())
            text = data["choices"][0]["message"]["content"]
            # 用正则全局切分 <##n> 标记（不要求行首），避免标记泄漏到译文里
            parts = re.split(r"<##(\d+)>", text)
            out = {}
            if len(parts) >= 3:
                for i in range(1, len(parts), 2):
                    idx = int(parts[i])
                    seg = parts[i + 1] if i + 1 < len(parts) else ""
                    seg = re.sub(r"</?##\d+>", "", seg)  # 清理残留闭合标记
                    out[idx] = seg.strip()
            return out
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"LLM 失败: {last}")

NEEDS_EN = re.compile(r"[A-Za-z]{3,}")

def extract_translatables(text, nl="\n"):
    """解析整个文件的 JSDoc，返回 [(行号, 原文行, 可译描述文本, 类型tag/plain)]"""
    lines = text.split(nl)
    items = []
    in_block = False
    for i, line in enumerate(lines):
        if "/**" in line:
            in_block = True
            continue
        if in_block and "*/" in line:
            in_block = False
            continue
        if not in_block:
            continue
        m = STAR.match(line)
        if not m:
            continue
        prefix, content = m.group(1), m.group(2)
        s = content.strip()
        if not s or s.startswith("@license") or s.startswith("@copyright"):
            continue
        # 判断是标签行还是纯描述行
        tm = TAG_LINE.match(s)
        if tm and tm.group(1):
            # 用平衡括号精确切分：标签 + {类型(可嵌套)} + [名字/默认值] + 描述
            # 避免 {{destroy: Function}} 这类嵌套类型把类型名误当描述翻译
            tag = tm.group(1)
            pos = len(tag)
            rest = s[pos:].lstrip()
            type_end = 0
            if rest.startswith("{"):
                depth = 0
                for k, ch in enumerate(rest):
                    if ch == "{": depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            type_end = k + 1
                            break
            after_type = rest[type_end:].strip()
            # 名字部分：[name=default] 或 name（保留原样）
            nm = re.match(r"^(\[[^\]]*\]|[A-Za-z_$][\w$]*)\s*(.*)$", after_type)
            if nm:
                namepart, desc = nm.group(1), nm.group(2).strip()
            else:
                namepart, desc = "", after_type
            desc = (desc or "").strip()
            if desc and NEEDS_EN.search(desc) and not re.fullmatch(r"[A-Za-z_$][\w$]*", desc):
                head = s[:len(s) - len(desc)]
                items.append((i, line, desc, "tag", head, prefix))
        else:
            # 纯描述行（但要排除 @xxx 单独行、示例代码块标记）
            if not s.startswith("@") and NEEDS_EN.search(s) and not s.startswith("```"):
                items.append((i, line, s, "plain", "", prefix))
    return items

def translate_file(src: Path, dst: Path):
    # newline="" 保留原始换行符（CRLF/LF），避免整文件被判定为改动
    with open(src, "r", encoding="utf-8", errors="surrogateescape", newline="") as fh:
        text = fh.read()
    nl = "\r\n" if "\r\n" in text else "\n"
    items = extract_translatables(text, nl)
    if not items:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as fh:
            fh.write(text)
        return 0

    # 分批翻译（每批约 2200 字符）
    groups, cur, size = [], [], 0
    for it in items:
        size += len(it[2]); cur.append(it)
        if size > 2200:
            groups.append(cur); cur = []; size = 0
    if cur: groups.append(cur)

    translated = {}
    for g in groups:
        res = call_llm([(j, it[2]) for j, it in enumerate(g)])
        for j, it in enumerate(g):
            translated[it[0]] = res.get(j, it[2])  # 用行号做 key

    # 回填（用原换行符 split，保留 CRLF）
    lines = text.split(nl)
    for line_no, orig, desc, kind, head, prefix in items:
        zh = translated.get(line_no, desc)
        # 模型可能把一段译文拆成多行；JSDoc 每个描述单元必须是一行，合并多余换行
        zh = re.sub(r"\s*\n\s*", " ", zh).strip()
        # 兜底清理任何残留标记
        zh = re.sub(r"</?##\d+>", "", zh).strip()
        if kind == "tag":
            new_line = prefix + head + zh
        else:
            new_line = prefix + zh
        lines[line_no] = new_line

    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as fh:
        fh.write(nl.join(lines))
    return len(items)

def load_cache():
    return json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}

def save_cache(c):
    CACHE.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--file", help="单个文件相对路径")
    ap.add_argument("--limit", type=int, help="只翻前N个文件（测试用）")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    cache = load_cache()
    files = sorted(SRC.rglob("*.js"))

    if args.stats:
        cached = sum(1 for f in files
                     if f.relative_to(SRC).as_posix() in cache
                     and cache[f.relative_to(SRC).as_posix()].get("hash") == sha256(f))
        need = [f for f in files if f.relative_to(SRC).as_posix() not in cache
                or cache[f.relative_to(SRC).as_posix()].get("hash") != sha256(f)]
        print(f"源文件 {len(files)} | 已缓存 {cached} | 待翻 {len(need)}")
        return

    if args.file:
        files = [SRC / args.file]
    elif args.limit:
        files = files[:args.limit]
    elif not args.all:
        print("请指定 --file / --limit / --all / --stats")
        return

    todo = []
    for f in files:
        rel = f.relative_to(SRC).as_posix()
        h = sha256(f)
        if not args.force and cache.get(rel, {}).get("hash") == h and (OUT / rel).exists():
            continue
        todo.append((f, rel, h))

    print(f"待翻译 {len(todo)} / {len(files)} 个文件", file=sys.stderr)
    ok = fail = 0
    for i, (src, rel, h) in enumerate(todo, 1):
        dst = OUT / rel
        print(f"[{i}/{len(todo)}] {rel}", file=sys.stderr)
        try:
            n = translate_file(src, dst)
            cache[rel] = {"hash": h, "blocks": n, "time": time.strftime("%Y-%m-%d %H:%M")}
            save_cache(cache)
            ok += 1
            print(f"    ✓ {n} 段", file=sys.stderr)
        except Exception as e:
            fail += 1
            print(f"    ✗ {e}", file=sys.stderr)
    print(f"\n完成: 成功 {ok}, 失败 {fail}", file=sys.stderr)

if __name__ == "__main__":
    main()
