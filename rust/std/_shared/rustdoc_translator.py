#!/usr/bin/env python3
"""翻译 Rust 标准库源码里的 rustdoc 文档注释（/// 与 //!）。

只改文档注释里的英文散文，代码/链接/泛型签名/属性全部原样保留。
- 代码块（``` 围栏内）不翻译
- 行内代码 `...`、链接 [文本](url) / [`Type`] 不翻译其代码部分
- 纯属性/指令行（# Examples 标题保留标记，其余英文标题翻译）
- SHA256 增量缓存：只翻变化的源文件

用法: python rustdoc_translator.py <std项目目录> [--stats|--all|--file X|--force]
"""
import re, json, hashlib, time, sys, argparse, urllib.request
from pathlib import Path

# 本地模型调用显式禁用代理，避免 urllib 因环境变量代理卡在 127.0.0.1 请求上
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

API = "http://127.0.0.1:8999/v1/chat/completions"
MODEL = "Hy-MT2-1.8B-Q4_K_M.gguf"

SYS = """你是专业的 Rust 技术文档翻译引擎。把用户给出的每段英文文档注释翻译成简体中文。
输入是多段用 <##数字> 标记的文本，逐段翻译，输出保留同样的标记，一段不漏、顺序不变。
硬性规则：
1. 只输出译文本身，不要原文、不要解释、不要加引号。
2. 以下内容绝对原样保留，不翻译、不修改：
   - 反引号 `...` 内的代码、类型名、函数名、标识符（如 `Vec<T>`、`Option`、`self`）
   - 链接里的 URL 与锚点 `[text](url)` 只翻译 text，url 不动；[`Type`] 里的代码不动
   - 泛型签名、类型名、参数名、属性名、数值、true/false、true 等字面量
3. 标题里的 # / ## 标记保留，只翻译后面的文字。
4. 术语统一：trait→trait（保留英文）, crate→crate, lifetime→生命周期, generic→泛型,
   iterator→迭代器, closure→闭包, slice→切片, ownership→所有权, borrow→借用,
   panic→panic, unsafe→unsafe, macro→宏。
5. 输入里的 <<<P数字>>> 是代码占位符，必须原样保留在输出的对应位置，绝不能修改或翻译它们。
6. 保持简洁，符合中文 Rust 技术文档习惯。
"""
TERMS_HINT = ""  # 术语已写死在 SYS 规则 4，config 的 terms 供 stats/文档参考

# 保护片段：行内代码、链接目标、HTML 标签
PROTECT = re.compile(r'(`[^`]*`|\]\([^)]*\)|<[^>]+>)')
DOC_LINE = re.compile(r'^(\s*)(///|//!)( ?)(.*)$')
FENCE = re.compile(r'^\s*(///|//!)?\s*```')


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def call_llm(blocks, retries=4):
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYS},
            {"role": "user", "content": "\n\n".join(f"<##{i}>\n{t}" for i, t in blocks)},
        ],
        "temperature": 0.1, "top_k": 50, "repeat_penalty": 1.05,
        "max_tokens": 4096,
    }).encode("utf-8")
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API, data=payload,
                headers={"Content-Type": "application/json"})
            with _OPENER.open(req, timeout=180) as r:
                data = json.loads(r.read())
            text = data["choices"][0]["message"]["content"]
            parts = re.split(r"<##(\d+)>", text)
            out = {}
            if len(parts) >= 3:
                for i in range(1, len(parts), 2):
                    idx = int(parts[i])
                    seg = parts[i + 1] if i + 1 < len(parts) else ""
                    seg = re.sub(r"</?##\d+>", "", seg)
                    out[idx] = seg.strip()
            return out
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"LLM 失败: {last}")


NEEDS_EN = re.compile(r"[A-Za-z]{3,}")


def is_protected_line(content):
    """文档注释里不该翻译的行：代码示例标记、纯链接目标、属性指令。"""
    s = content.strip()
    if not s:
        return True
    if FENCE.match(content):
        return True
    # 纯属性/指令行（如 #[doc(...)] 已在注释外，这里针对注释内 #![...]）
    if re.match(r'^#!?\[', s):
        return True
    # 纯链接目标定义：[foo]: url
    if re.match(r'^\[[^\]]+\]:\s*\S', s):
        return True
    return False


def mask_protected(s):
    """把保护片段替换成可见占位符 <<<Pn>>>，返回 (masked, parts)。"""
    parts = []
    def repl(m):
        parts.append(m.group(0))
        return f"<<<P{len(parts)-1}>>>"
    return PROTECT.sub(repl, s), parts


def unmask(s, parts):
    def repl(m):
        idx = int(m.group(1))
        return parts[idx] if idx < len(parts) else m.group(0)
    return re.sub(r'<<<P(\d+)>>>', repl, s)


def translate_file(src, dst, cfg):
    with open(src, "r", encoding="utf-8", errors="surrogateescape", newline="") as fh:
        text = fh.read()
    nl = "\r\n" if "\r\n" in text else "\n"
    lines = text.split(nl)

    # 收集可翻译项：(行号, 原文content, masked文本, parts)
    items = []
    in_code = False
    for i, line in enumerate(lines):
        m = DOC_LINE.match(line)
        if not m:
            continue
        indent, marker, space, content = m.groups()
        if FENCE.match(content):
            in_code = not in_code
            continue
        if in_code or is_protected_line(content):
            continue
        if not NEEDS_EN.search(content):
            continue
        masked, parts = mask_protected(content)
        if not NEEDS_EN.search(masked):
            continue
        items.append((i, content, masked, parts))

    if not items:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as fh:
            fh.write(text)
        return 0

    # 分批（约 2200 字符）
    groups, cur, size = [], [], 0
    for it in items:
        size += len(it[2])
        cur.append(it)
        if size > 2200:
            groups.append(cur); cur = []; size = 0
    if cur:
        groups.append(cur)

    translated = {}
    for g in groups:
        res = call_llm([(j, it[2]) for j, it in enumerate(g)])
        for j, it in enumerate(g):
            translated[it[0]] = res.get(j, it[2])

    # 回填：保留原前缀（indent + marker + space）
    for line_no, orig, masked, parts in items:
        zh = translated.get(line_no, masked)
        zh = re.sub(r"\s*\n\s*", " ", zh).strip()
        zh = re.sub(r"</?##\d+>", "", zh).strip()
        # 保真校验：占位符必须原样保留，且不能出现残缺形式（如 <<<P0>>），否则宁可保留原文
        expect = sorted(int(x) for x in re.findall(r'<<<P(\d+)>>>', masked))
        got = sorted(int(x) for x in re.findall(r'<<<P(\d+)>>>', zh))
        malformed = re.search(r'<<<?P\d+>{1,2}(?!>)', zh) or re.search(r'P\d+>>', zh)
        if expect != got or malformed:
            zh = masked  # 保真失败，跳过这行翻译
        # 翻译时可能把开头的 # 标题标记弄丢，从原文恢复
        hm = re.match(r'^(#{1,6}\s+)', orig)
        if hm and not re.match(r'^#{1,6}\s+', zh):
            zh = hm.group(1) + zh
        zh = unmask(zh, parts)
        m = DOC_LINE.match(lines[line_no])
        indent, marker, space, _ = m.groups()
        lines[line_no] = f"{indent}{marker}{space}{zh}"

    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as fh:
        fh.write(nl.join(lines))
    return len(items)


def load_cache(path):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_cache(path, cache):
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def progress(done, total, t0):
    pct = done / total * 100 if total else 0
    filled = int(24 * done / total) if total else 0
    bar = "█" * filled + "░" * (24 - filled)
    rate = done / (time.time() - t0) * 60 if time.time() > t0 else 0
    eta = (total - done) / rate if rate > 0 else 0
    return f"[{bar}] {done}/{total} ({pct:5.1f}%) | {rate:4.1f}篇/分 | 剩余 {int(eta)}分"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--file")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="只翻前 N 篇待翻文件（分批用）")
    args = ap.parse_args()

    proj = Path(args.project).resolve()
    cfg = json.loads((proj / "config.json").read_text(encoding="utf-8"))
    src_root = proj / cfg["src_dir"]
    dst_root = proj / "translated"
    cache_path = proj / "cache.json"
    cache = load_cache(cache_path)

    all_files = sorted(f for f in src_root.rglob("*.rs"))
    if args.stats or not (args.all or args.file):
        todo = [f for f in all_files if cache.get(f.relative_to(src_root).as_posix(), {}).get("hash") != sha256(f)]
        print(f"[{cfg['name']}] 总 {len(all_files)} 篇 | 已缓存 {len(all_files)-len(todo)} | 待翻 {len(todo)}")
        if todo:
            print("  待翻示例:", ", ".join(f.relative_to(src_root).as_posix() for f in todo[:5]))
        return

    files = [src_root / args.file] if args.file else all_files
    if args.file and not files[0].exists():
        print(f"文件不存在: {args.file}"); return
    if args.limit and not args.file:
        # 只取前 N 篇待翻的（跳过已缓存）
        pending = [f for f in files
                   if args.force or cache.get(f.relative_to(src_root).as_posix(), {}).get("hash") != sha256(f)]
        files = pending[:args.limit]
    ok = skip = fail = 0
    t0 = time.time()
    print(f"=== 开始翻译 {cfg['name']}（{len(files)} 篇）===", flush=True)
    for idx, src in enumerate(files, 1):
        rel = src.relative_to(src_root).as_posix()
        h = sha256(src)
        if not args.force and cache.get(rel, {}).get("hash") == h:
            skip += 1
        else:
            try:
                n = translate_file(src, dst_root / rel, cfg)
                cache[rel] = {"hash": h, "segments": n}
                save_cache(cache_path, cache)
                ok += 1
            except Exception as e:
                fail += 1
                print(f"\n  ✗ {rel}: {e}", file=sys.stderr, flush=True)
        if idx % 10 == 0 or idx == 1 or idx == len(files):
            print(progress(idx, len(files), t0), flush=True)
    print(f"\n完成: 成功 {ok}, 跳过 {skip}, 失败 {fail}")


if __name__ == "__main__":
    main()
