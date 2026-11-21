#!/usr/bin/env python3
"""Leaflet 1.9.4 教程文档（Jekyll markdown）翻译器。

只翻译正文自然语言，跳过：
- frontmatter 的结构键（layout/title 的值翻译，键不动）
- 代码块（``` 围栏）与缩进代码
- Liquid 标签 {% ... %} 与变量 {{ ... }}
- HTML 标签/注释
- 图片、链接 URL、行内代码
"""
import argparse, hashlib, json, re, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "repo" / "docs" / "examples"
OUT = ROOT / "translated" / "docs" / "examples"
CACHE = ROOT / "cache_tutorial.json"
API = "http://127.0.0.1:8999/v1/chat/completions"
MODEL = "Hy-MT2-1.8B-Q4_K_M.gguf"

TERMS = {
    "map": "地图", "marker": "标记", "layer": "图层",
    "tile layer": "瓦片图层", "popup": "弹出窗口", "tooltip": "工具提示",
    "control": "控件", "bounds": "边界", "geojson": "GeoJSON",
    "attribution": "归属信息", "polyline": "折线", "polygon": "多边形",
}

SYS = """你是技术文档翻译助手。把用户给出的每一段英文逐段翻译成中文。规则：
1. 保留每段前面的 <##数字> 标记，一段都不能少、不能乱序。
2. 技术术语、API 名称、类名、方法名、参数名、代码、反引号 `...` 内的内容、URL、Liquid 标签、数字保持原样不译。
3. 只翻译自然语言描述，译文简洁准确、符合中文技术文档习惯。
4. 不要添加任何解释或额外文字，只输出带标记的译文。
5. 每段译文保持单行，不要换行。
"""


def load_cache():
    if CACHE.exists():
        try: return json.loads(CACHE.read_text(encoding="utf-8"))
        except Exception: return {}
    return {}

def save_cache(c):
    CACHE.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")

def file_hash(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def needs_translation(s):
    if not s.strip(): return False
    if re.search(r'[一-龥]', s): return False
    # 跳过 Liquid / HTML / 纯代码符号行
    t = s.strip()
    if t.startswith(('{%', '{{', '<', '</', '!', '#', '|', '---')): return False
    if '{%' in t or '{{' in t: return False
    # 含 <tag> HTML
    if re.search(r'<[a-zA-Z][^>]*>', t): return False
    words = re.findall(r'[A-Za-z]{2,}', t)
    if len(words) < 2: return False
    return True

def extract(text, nl):
    """逐行解析，返回 (lines, [(行号, 原文, 描述, prefix)])。"""
    lines = text.split(nl)
    items = []
    in_code = False
    in_fm = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        # frontmatter 起止
        if i == 0 and stripped == "---":
            in_fm = True
            continue
        if in_fm:
            if stripped == "---":
                in_fm = False
                continue
            # frontmatter 里：title/description 的值翻译，其余跳过
            m = re.match(r'^(title|description):\s*(.+)$', line)
            if m and needs_translation(m.group(2)):
                items.append((i, line, m.group(2).strip(), f"{m.group(1)}: "))
            continue
        # 代码围栏
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_code = not in_code
            continue
        if in_code:
            continue
        # 缩进代码块（tab 或 4 空格开头，教程里常见）
        if line.startswith("\t") or line.startswith("    "):
            continue
        # markdown 标题/列表/引用的前缀
        prefix = ""
        m = re.match(r'^(\s*(?:#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s+)?)(.*)$', line)
        if m:
            prefix, body = m.group(1), m.group(2)
        else:
            body = line
        if needs_translation(body):
            items.append((i, line, body.strip(), prefix))
    return lines, items

def post_process(text):
    parts = text.split("`")
    for i in range(0, len(parts), 2):
        for en, zh in sorted(TERMS.items(), key=lambda x: -len(x[0])):
            parts[i] = re.sub(r'\b' + re.escape(en) + r'\b', zh, parts[i], flags=re.I)
    return "`".join(parts)

def call_llm(segments):
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
        payload_text = "\n".join(f"<##{k}>\n{t}" for k, t in batch)
        payload = json.dumps({
            "model": MODEL,
            "messages": [{"role": "system", "content": SYS},
                         {"role": "user", "content": payload_text}],
            "temperature": 0.1, "top_k": 50, "repeat_penalty": 1.1,
            "max_tokens": 2048,
        }).encode("utf-8")
        req = urllib.request.Request(API, data=payload, headers={"Content-Type": "application/json"})
        text = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.loads(resp.read())
                text = data["choices"][0]["message"]["content"]
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  LLM 失败: {e}", file=sys.stderr); return result
                time.sleep(2)
        parts = re.split(r'<##(\d+)>', text)
        keys = dict(batch)
        for j in range(1, len(parts), 2):
            key = int(parts[j])
            val = " ".join((parts[j+1] if j+1 < len(parts) else "").split())
            if key in keys: result[key] = val
    return result

def translate_file(src, dst):
    with open(src, "r", encoding="utf-8", errors="surrogateescape", newline="") as f:
        text = f.read()
    nl = "\r\n" if "\r\n" in text else "\n"
    lines, items = extract(text, nl)
    if not items:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
            f.write(text)
        return 0
    translated = call_llm([(i, desc) for i, _, desc, _ in items])
    for line_no, orig, desc, prefix in items:
        zh = translated.get(line_no, desc)
        zh = re.sub(r'^(?:#{1,6}|[-*>+]|\d+\.)\s+', '', zh.lstrip())
        zh = post_process(zh)
        lines[line_no] = prefix + zh
    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
        f.write(nl.join(lines))
    return len(items)

def collect_files():
    return sorted(f for f in SRC.rglob("*.md"))

def stats():
    cache = load_cache()
    files = collect_files()
    todo = [f for f in files if cache.get(f.relative_to(SRC).as_posix(), {}).get("hash") != file_hash(f)]
    print(f"教程 md: {len(files)}")
    print(f"已缓存: {len(files) - len(todo)}")
    print(f"待翻译: {len(todo)}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--file")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    if args.stats:
        stats(); return
    cache = load_cache()
    files = [SRC / args.file] if args.file else collect_files()
    ok = skip = fail = 0
    t0 = time.time()
    for idx, src in enumerate(files, 1):
        if not src.exists():
            print(f"不存在: {src}"); continue
        rel = src.relative_to(SRC).as_posix()
        h = file_hash(src)
        if not args.force and cache.get(rel, {}).get("hash") == h:
            skip += 1; continue
        try:
            n = translate_file(src, OUT / rel)
            cache[rel] = {"hash": h, "segments": n}
            save_cache(cache)
            ok += 1
            print(f"[{idx}/{len(files)}] ✓ {rel} ({n} 段)", flush=True)
        except Exception as e:
            fail += 1
            print(f"[{idx}/{len(files)}] ✗ {rel}: {e}", file=sys.stderr, flush=True)
    print(f"\n完成: 成功 {ok}, 跳过 {skip}, 失败 {fail}, 耗时 {int(time.time()-t0)}s")

if __name__ == "__main__":
    main()
