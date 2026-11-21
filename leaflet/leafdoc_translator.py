#!/usr/bin/env python3
"""Leaflet 1.9.4 Leafdoc 注释翻译器。

只翻译注释里的自然语言描述行，元数据（@method/@option/@property/@event/
@factory/@function/@class/@aka/@section 等标签、类型、参数名、默认值、
@example 代码块）一律原样保留。代码本体绝不动。

复用 Cesium 翻译器的基础设施：SHA256 内容哈希缓存、断点续传、
<##n> 标记批量翻译、CRLF 换行保留、术语表后处理。
"""
import argparse, hashlib, json, re, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "repo" / "src"
OUT = ROOT / "translated" / "src"
CACHE = ROOT / "cache.json"
API = "http://127.0.0.1:8999/v1/chat/completions"
MODEL = "Hy-MT2-1.8B-Q4_K_M.gguf"

# 术语表（Leaflet 专有）
TERMS = {
    "map": "地图",
    "marker": "标记",
    "layer": "图层",
    "tile layer": "瓦片图层",
    "popup": "弹出窗口",
    "tooltip": "工具提示",
    "panel": "面板",
    "control": "控件",
    "bounds": "边界",
    "attribution": "归属信息",
    "projection": "投影",
    "coordinate reference system": "坐标参考系",
    "geojson": "GeoJSON",
    "polyline": "折线",
    "polygon": "多边形",
}

SYS = """你是技术文档翻译助手。把用户给出的每一段英文逐段翻译成中文。规则：
1. 保留每段前面的 <##数字> 标记，一段都不能少、不能乱序。
2. 技术术语、API 名称、类名、方法名、参数名、变量名、代码、反引号 `...` 内的内容、URL、数字、类型名保持英文原样，不要翻译。
3. 只翻译自然语言描述，译文简洁准确、符合中文技术文档习惯。
4. 不要添加任何解释、注释或额外文字，只输出带标记的译文。
5. 每段译文保持单行，不要换行。
"""

# Leafdoc 元数据标签（这些行整行保留，不翻译）
META_TAGS = {
    "method", "option", "property", "event", "factory", "function",
    "class", "miniclass", "namespace", "aka", "section", "inherits",
    "alternative", "pane", "crs", "projection", "constructor",
    "uninheritable", "type", "returns", "param", "category", "example",
    "namespace", "event", "requires", "uses", "deprecated", "since",
}

# 一行注释的前缀：// 或 /* 块内的 *
COMMENT_RE = re.compile(r'^(\s*(?://|/\*|\*)\s?)(.*)$')


def load_cache():
    if CACHE.exists():
        try:
            return json.loads(CACHE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(c):
    CACHE.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_comment_line(line):
    """返回 (prefix, content) 若是注释行，否则 None。
    prefix 是 '// ' / ' * ' / '/* ' 这种前缀，content 是注释正文。"""
    s = line
    # // 行注释
    m = re.match(r'^(\s*//\s?)(.*)$', s)
    if m:
        return m.group(1), m.group(2)
    # 块注释内的 * 行（含开头的 /*）
    m = re.match(r'^(\s*(?:/\*+|\*+)\s?)(.*)$', s)
    if m:
        return m.group(1), m.group(2)
    return None


def extract_translatables(text, nl):
    """解析文件，返回 [(行号, 原文行, 描述文本, prefix)]。
    只提取『元数据标签行后面紧跟的描述行』和块注释开头的类/方法描述行。"""
    lines = text.split(nl)
    items = []
    i = 0
    n = len(lines)
    while i < n:
        cl = is_comment_line(lines[i])
        if not cl:
            i += 1
            continue
        prefix, content = cl
        stripped = content.strip()

        # 元数据标签行：整行保留，但记录它后面是否有描述行
        meta = re.match(r'^@([a-zA-Z][\w-]*)\b', stripped)
        if meta:
            tag = meta.group(1)
            # 标签行本身不翻译；描述在后续行
            i += 1
            # @example 块：整体跳过（直到下一个 @ 标签或注释结束）
            if tag == "example":
                while i < n:
                    cl2 = is_comment_line(lines[i])
                    if not cl2:
                        break
                    c2 = cl2[1].strip()
                    if c2.startswith("@") or not c2:
                        if c2:  # 下一个 @ 标签，回退让它被处理
                            break
                        i += 1
                        continue
                    i += 1  # 跳过示例内容
                continue
            # 收集紧跟的描述行（连续的非 @ 开头注释行）
            while i < n:
                cl2 = is_comment_line(lines[i])
                if not cl2:
                    break
                p2, c2 = cl2
                s2 = c2.strip()
                if not s2 or s2.startswith("@"):
                    break
                # 跳过看起来像代码的行（含 { } 类型定义、= 赋值、函数调用等）
                if needs_translation(s2):
                    items.append((i, lines[i], s2, p2))
                i += 1
            continue

        # 块注释开头的自由描述行（如 /* @class LatLng 下的 "Represents a..."）
        # 或 // 开头的纯描述（不属于任何标签）
        # 判断是否描述性文字（有英文字母且非代码）
        if stripped and needs_translation(stripped):
            # 排除 @class/@aka 这类标签同行
            items.append((i, lines[i], stripped, prefix))
        i += 1
    return lines, items


def needs_translation(s):
    """判断一行是否是需要翻译的自然语言描述。"""
    if not s:
        return False
    # 含中文 → 已翻过，跳过
    if re.search(r'[一-龥]', s):
        return False
    # 必须有英文字母词（>=2 字母的单词至少 2 个，或一句话）
    words = re.findall(r'[A-Za-z]{2,}', s)
    if len(words) < 2:
        return False
    # 纯类型/签名行：含 : Type 模式且没有描述性词
    # 排除代码字面量行
    if s.startswith(("{", "}", "[", "]", "import ", "export ", "var ", "const ", "let ",
                     "function ", "return ", "L.", "new ", "<", "</")):
        return False
    # 含大量代码符号但少文字 → 可能是代码
    code_chars = len(re.findall(r'[{}();=<>|\t]', s))
    if code_chars > len(s) * 0.25:
        return False
    return True


def post_process(text):
    """术语表后处理，跳过反引号内的行内代码。"""
    parts = text.split("`")
    for i in range(0, len(parts), 2):
        for en, zh in sorted(TERMS.items(), key=lambda x: -len(x[0])):
            parts[i] = re.sub(r'\b' + re.escape(en) + r'\b', zh, parts[i], flags=re.I)
    return "`".join(parts)


def call_llm(segments):
    """批量翻译，segments = [(key, text)]，返回 {key: translation}。"""
    if not segments:
        return {}
    # 拼 prompt，每批最多 2200 字符
    batches = []
    cur, cur_len = [], 0
    for k, t in segments:
        block = f"<##{k}>\n{t}\n"
        if cur_len + len(block) > 2200 and cur:
            batches.append(cur)
            cur, cur_len = [], 0
        cur.append((k, t))
        cur_len += len(block)
    if cur:
        batches.append(cur)

    result = {}
    for batch in batches:
        payload_text = "\n".join(f"<##{k}>\n{t}" for k, t in batch)
        payload = json.dumps({
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYS},
                {"role": "user", "content": payload_text},
            ],
            "temperature": 0.1, "top_k": 50, "repeat_penalty": 1.1,
            "max_tokens": 2048,
        }).encode("utf-8")
        req = urllib.request.Request(API, data=payload,
                                     headers={"Content-Type": "application/json"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.loads(resp.read())
                text = data["choices"][0]["message"]["content"]
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  LLM 失败: {e}", file=sys.stderr)
                    return result
                time.sleep(2)
        # 解析 <##n> 分段（用 re.split 全局切分，不假设标记在行首）
        parts = re.split(r'<##(\d+)>', text)
        for j in range(1, len(parts), 2):
            key = int(parts[j])
            val = parts[j + 1].strip() if j + 1 < len(parts) else ""
            # 合并多余换行为空格（保持单行）
            val = " ".join(val.split())
            if key in dict(batch):
                result[key] = val
    return result


def translate_file(src, dst):
    # 用 newline="" 保留原始 CRLF
    with open(src, "r", encoding="utf-8", errors="surrogateescape", newline="") as f:
        text = f.read()
    nl = "\r\n" if "\r\n" in text else "\n"

    lines, items = extract_translatables(text, nl)
    if not items:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
            f.write(text)
        return 0

    segments = [(i, desc) for i, _, desc, _ in items]
    translated = call_llm(segments)

    # 回填
    for line_no, orig, desc, prefix in items:
        zh = translated.get(line_no, desc)
        # 剥离模型可能带出的重复前缀标记
        zh = re.sub(r'^(?:#{1,6}|[-*>+])\s+', '', zh.lstrip())
        zh = post_process(zh)
        lines[line_no] = prefix + zh

    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
        f.write(nl.join(lines))
    return len(items)


def collect_files():
    return sorted(f for f in SRC.rglob("*.js"))


def stats():
    cache = load_cache()
    files = collect_files()
    todo = []
    for f in files:
        rel = f.relative_to(SRC).as_posix()
        h = file_hash(f)
        if cache.get(rel, {}).get("hash") != h:
            todo.append(rel)
    print(f"源码 js: {len(files)}")
    print(f"已缓存: {len(files) - len(todo)}")
    print(f"待翻译: {len(todo)}")
    return todo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--file", help="只翻单个文件（相对 src/ 的路径）")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if args.stats:
        stats()
        return

    cache = load_cache()
    if args.file:
        files = [SRC / args.file]
        if not files[0].exists():
            print(f"文件不存在: {args.file}")
            return
    else:
        files = collect_files()

    ok = skip = fail = 0
    total_start = time.time()
    for idx, src in enumerate(files, 1):
        rel = src.relative_to(SRC).as_posix()
        h = file_hash(src)
        if not args.force and cache.get(rel, {}).get("hash") == h:
            skip += 1
            continue
        dst = OUT / rel
        try:
            n = translate_file(src, dst)
            cache[rel] = {"hash": h, "segments": n}
            save_cache(cache)
            ok += 1
            print(f"[{idx}/{len(files)}] ✓ {rel} ({n} 段)", flush=True)
        except Exception as e:
            fail += 1
            print(f"[{idx}/{len(files)}] ✗ {rel}: {e}", file=sys.stderr, flush=True)
    print(f"\n完成: 成功 {ok}, 跳过 {skip}, 失败 {fail}, 耗时 {int(time.time()-total_start)}s")


if __name__ == "__main__":
    main()
