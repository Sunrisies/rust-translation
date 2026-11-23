#!/usr/bin/env python3
"""Rust 文档通用增量翻译引擎（5 本书共用）——段落块模式。

核心改进（相比按行翻译）：
- 按「段落块」（空行分隔）翻译，保持句子完整，杜绝跨行句子被拆散导致的串位/残留
- 批次里没返回的段落逐个单独重试，绝不残留英文原文
- SHA256 缓存 + 实时进度条（每篇 [n/total] 百分比 速度 ETA）
- 保护代码块/行内代码/链接URL/图片/MdBook {{#include}} 标记/表格分隔行
- 保留 CRLF 换行

用法:
  python md_translator.py <项目目录> --stats | --all | --file X.md | --force
"""
import argparse, hashlib, json, re, sys, time, urllib.request, fnmatch
from pathlib import Path

API = "http://127.0.0.1:8999/v1/chat/completions"
MODEL = "Hy-MT2-1.8B-Q4_K_M.gguf"

DEFAULT_TERMS = {
    "trait": "trait", "lifetime": "生命周期", "crate": "crate",
    "ownership": "所有权", "borrowing": "借用", "borrow checker": "借用检查器",
    "struct": "结构体", "enum": "枚举", "impl": "实现",
    "macro": "宏", "closure": "闭包", "iterator": "迭代器",
    "type system": "类型系统", "generic": "泛型", "async": "异步",
    "unsafe": "不安全", "smart pointer": "智能指针",
    "error handling": "错误处理", "pattern matching": "模式匹配",
}
SYS_TMPL = """你是专业的技术文档翻译引擎。把用户给出的每一段英文技术文档翻译成简体中文。
硬性规则：
1. 输入包含多个用 <##数字> 开头标记的段落，你必须为每一段输出译文，保留同样的 <##数字> 标记，顺序不变，一段不漏。
2. 每段是一个完整段落（可能含换行），翻译后保持为一段，不要拆分或合并段落。
3. 绝对不要修改 Markdown 标记：**加粗**、`行内代码`、[链接文本](url)、HTML 标签、{{#include}} 等模板标记。链接文本可译，url 不译。
4. `行内代码`、文件路径、类型名、函数名、命令、代码、技术术语（{terms_list}）保持英文原样。
5. 不要增删信息，不要加解释。只输出带标记的译文，不要输出原文或评论。
6. 引用块（以 > 开头）里的正文也必须翻译，保留行首的 > 符号；[!NOTE]/[!TIP]/[!WARNING] 等提示标记、命令行示例、代码不要翻译。
"""

def load_cfg(proj):
    cfg = json.loads((proj / "config.json").read_text(encoding="utf-8"))
    terms = dict(DEFAULT_TERMS); terms.update(cfg.get("terms", {}))
    cfg["terms"] = terms
    return cfg

def file_hash(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def load_cache(proj):
    p = proj / "cache.json"
    if p.exists():
        try: return json.loads(p.read_text(encoding="utf-8"))
        except Exception: return {}
    return {}
def save_cache(proj, c): (proj / "cache.json").write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")

def post_process(text, terms):
    parts = text.split("`")
    for i in range(0, len(parts), 2):
        for en, zh in sorted(terms.items(), key=lambda x: -len(x[0])):
            parts[i] = re.sub(r'\b' + re.escape(en) + r'\b', zh, parts[i], flags=re.I)
    return "`".join(parts)

def is_protected(line):
    s = line.strip()
    if not s: return False
    if s.startswith("```") or s.startswith("~~~"): return True
    if s.startswith(("{{", "<!--", "<", "![", "|", "#[", "///", "//!")): return True
    if re.fullmatch(r'[\s|:\-]+', s): return True  # 表格分隔行
    return False

def needs_translation(block):
    if not block.strip(): return False
    if re.search(r'[一-龥]', block): return False
    words = re.findall(r'[A-Za-z]{2,}', block)
    # 标题（# Installation）可能只有一个单词，也要翻译
    if block.lstrip().startswith("#"):
        return len(words) >= 1
    return len(words) >= 2

def _quote_inner(s):
    """返回引用行去掉 > 后的内容；非引用行返回 None。"""
    s = s.strip()
    if not s.startswith(">"):
        return None
    return s.lstrip("> ").strip()

def _is_list_or_heading(s):
    """判断是否为列表项或标题起始行（用于把相邻列表项拆成独立块）。"""
    s = s.strip()
    return bool(re.match(r'^(?:[-*+]|\d+\.)\s+', s) or re.match(r'^#{1,6}\s+', s))

def extract_blocks(text, nl):
    """按段落块提取。支持引用块正文翻译，同时保护引用块内的代码和提示标记。"""
    lines = text.split(nl)
    blocks = []
    i = 0
    in_code = False
    in_quote_code = False
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith("```") or s.startswith("~~~"):
            in_code = not in_code
            i += 1; continue
        if in_code:
            i += 1; continue
        inner = _quote_inner(s)
        if inner is not None:
            if inner.startswith("```") or inner.startswith("~~~"):
                in_quote_code = not in_quote_code
                i += 1; continue
            # 引用块内的代码、空引用行、mdBook 提示标记：不翻译
            if in_quote_code or not inner or re.match(r'^\[!\w+\]', inner):
                i += 1; continue
        if is_protected(lines[i]) or not s:
            i += 1; continue
        start = i
        buf = []
        while i < len(lines):
            cur = lines[i].strip()
            if not cur or is_protected(lines[i]) or cur.startswith("```") or cur.startswith("~~~"):
                break
            q = _quote_inner(cur)
            if q is not None and (not q or re.match(r'^\[!\w+\]', q) or q.startswith("```") or q.startswith("~~~")):
                break
            # 相邻列表项/标题各自独立成块，避免多个列表项被合并成一行
            if buf and _is_list_or_heading(cur):
                break
            buf.append(lines[i]); i += 1
        # 引用行合并时去掉行首 >，由 prefix 统一恢复，避免译文里残留多余 >
        block_text = " ".join(
            (x.strip().lstrip("> ").strip() if x.strip().startswith(">") else x.strip())
            for x in buf
        )
        if needs_translation(block_text):
            prefix_m = re.match(r'^(\s*(?:>\s*)?(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+)?)', buf[0])
            prefix = prefix_m.group(1) if prefix_m else ""
            blocks.append((start, i, block_text, prefix))
    return lines, blocks

def call_llm(segments, sys):
    if not segments: return {}
    batches, cur, cur_len = [], [], 0
    for k, t in segments:
        block = f"<##{k}>\n{t}\n"
        if cur_len + len(block) > 2200 and cur:
            batches.append(cur); cur, cur_len = [], 0
        cur.append((k, t)); cur_len += len(block)
    if cur: batches.append(cur)
    result = {}
    for batch in batches:
        r = _call_batch(batch, sys)
        result.update(r)
        missing = [k for k, _ in batch if k not in result]
        for k in missing:
            r2 = _call_batch([(k, dict(batch)[k])], sys)
            if k in r2: result[k] = r2[k]
    return result

def _call_batch(batch, sys):
    payload_text = "\n".join(f"<##{k}>\n{t}" for k, t in batch)
    payload = json.dumps({
        "model": MODEL,
        "messages": [{"role": "system", "content": sys}, {"role": "user", "content": payload_text}],
        "temperature": 0.1, "top_k": 50, "repeat_penalty": 1.1, "max_tokens": 4096,
    }).encode("utf-8")
    req = urllib.request.Request(API, data=payload, headers={"Content-Type": "application/json"})
    text = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                text = json.loads(resp.read())["choices"][0]["message"]["content"]
            break
        except Exception as e:
            if attempt == 2:
                print(f"\n  LLM失败: {e}", file=sys.stderr); return {}
            time.sleep(2)
    if not text: return {}
    parts = re.split(r'<##(\d+)>', text)
    keys = dict(batch); out = {}
    for j in range(1, len(parts), 2):
        key = int(parts[j])
        val = " ".join((parts[j+1] if j+1 < len(parts) else "").split())
        if key in keys and val: out[key] = val
    return out

def translate_summary(text, nl, sys, cfg):
    """SUMMARY.md 专用：只翻译 [链接文本] 里的文字，保持列表/缩进/url 结构完全不动。"""
    lines = text.split(nl)
    # 提取所有 [text](url) 里的 text
    link_texts = []
    for i, line in enumerate(lines):
        for m in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', line):
            t = m.group(1)
            if t and not re.search(r'[一-龥]', t) and len(re.findall(r'[A-Za-z]{2,}', t)) >= 1:
                link_texts.append((i, t, m.group(2)))
    if not link_texts: return text, 0
    # 去重后批量翻译（只发链接文本本身）
    uniq = {}
    for i, t, u in link_texts: uniq.setdefault(t, [])
    trans = call_llm([(k, t) for k, t in enumerate(uniq.keys())],
                     "把下列每段短语翻译成中文，保留 <##数字> 标记，一段不漏，只输出译文：")
    zh_map = {t: trans.get(k, t) for k, t in enumerate(uniq.keys())}
    # 回填：精确替换 [text](url) 的 text
    for i, t, u in link_texts:
        zh = post_process(zh_map.get(t, t), cfg["terms"])
        lines[i] = lines[i].replace(f'[{t}]({u})', f'[{zh}]({u})', 1)
    return nl.join(lines), len(link_texts)

def translate_file(src, dst, cfg, sys):
    with open(src, "r", encoding="utf-8", errors="surrogateescape", newline="") as f: text = f.read()
    nl = "\r\n" if "\r\n" in text else "\n"
    # SUMMARY.md 走专用逻辑（保护目录结构）
    if src.name == "SUMMARY.md":
        out, n = translate_summary(text, nl, sys, cfg)
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as f: f.write(out)
        return n
    lines, blocks = extract_blocks(text, nl)
    if not blocks:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as f: f.write(text)
        return 0
    translated = call_llm([(i, txt) for i, (_, _, txt, _) in enumerate(blocks)], sys)
    # 回填：一个块 → 一行译文（替换首行，删除其余行）；保留 prefix
    for idx in sorted(range(len(blocks)), reverse=True):
        start, end, orig, prefix = blocks[idx]
        zh = translated.get(idx, orig)
        zh = re.sub(r'^(?:>\s*)?(?:#{1,6}|[-*>+]|\d+\.)\s+', '', zh.lstrip())
        # 引用块内的标题（> ### Title）和列表项前缀已由 prefix 保留，无需再推断
        lines[start:end] = [prefix + post_process(zh, cfg["terms"])]
    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
        f.write(nl.join(lines))
    return len(blocks)

def progress_bar(done, total, start, width=24):
    pct = done / total * 100 if total else 0
    filled = int(width * done / total) if total else 0
    bar = "█" * filled + "░" * (width - filled)
    elapsed = time.time() - start
    rate = done / elapsed * 60 if elapsed > 0 else 0
    eta = (total - done) / rate if rate > 0 else 0
    eta_s = f"{int(eta//60)}分{int(eta%60)}秒" if eta < 3600 else f"{eta/3600:.1f}小时"
    return f"[{bar}] {done}/{total} ({pct:5.1f}%) | {rate:5.1f}篇/分 | 剩余 {eta_s}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--file")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    proj = Path(args.project).resolve()
    cfg = load_cfg(proj)
    src_dir = proj / cfg["src_dir"]
    dst_dir = proj / "content"
    cache = load_cache(proj)
    sys = SYS_TMPL.format(terms_list=", ".join(sorted(cfg["terms"])[:14]))

    all_files = sorted(f for f in src_dir.rglob("*.md"))
    if cfg.get("include"):
        all_files = [f for f in all_files if any(fnmatch.fnmatch(f.name, p) for p in cfg["include"])]
    # copy_only: 超大/低价值文件（如 CHANGELOG）原样复制，不翻译
    copied = []
    for pat in cfg.get("copy_only", []):
        for f in list(all_files):
            if fnmatch.fnmatch(f.name, pat):
                rel = f.relative_to(src_dir).as_posix()
                out = dst_dir / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(f.read_bytes())
                cache[rel] = {"hash": file_hash(f), "segments": 0, "copied": True}
                copied.append(f)
                all_files.remove(f)
    if copied:
        save_cache(proj, cache)
        print(f"原样复制 {len(copied)} 篇（未翻译）: {', '.join(f.name for f in copied[:5])}", flush=True)
    if args.stats or not (args.all or args.file):
        todo = [f for f in all_files if cache.get(f.relative_to(src_dir).as_posix(), {}).get("hash") != file_hash(f)]
        print(f"[{cfg['name']}] 总 {len(all_files)} 篇 | 已缓存 {len(all_files)-len(todo)} | 待翻 {len(todo)}")
        if todo: print("  待翻示例:", ", ".join(f.relative_to(src_dir).as_posix() for f in todo[:5]))
        return
    files = [src_dir / args.file] if args.file else all_files
    if args.file and not files[0].exists(): print(f"文件不存在: {args.file}"); return
    ok = skip = fail = 0; t0 = time.time()
    print(f"=== 开始翻译 {cfg['name']}（{len(files)} 篇）===", flush=True)
    for idx, src in enumerate(files, 1):
        rel = src.relative_to(src_dir).as_posix(); h = file_hash(src)
        if not args.force and cache.get(rel, {}).get("hash") == h:
            skip += 1
        else:
            try:
                n = translate_file(src, dst_dir / rel, cfg, sys)
                cache[rel] = {"hash": h, "segments": n}; save_cache(proj, cache); ok += 1
            except Exception as e:
                fail += 1; print(f"\n  ✗ {rel}: {e}", file=sys.stderr, flush=True)
        if idx % 5 == 0 or idx == 1 or idx == len(files):
            print(progress_bar(idx, len(files), t0), flush=True)
        else:
            print("\r" + progress_bar(idx, len(files), t0), end="", flush=True)
    print()
    elapsed = time.time() - t0
    print(f"完成: 成功 {ok}, 跳过 {skip}, 失败 {fail}, 耗时 {int(elapsed//60)}分{int(elapsed%60)}秒")

if __name__ == "__main__": main()
