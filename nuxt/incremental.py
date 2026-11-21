#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Nuxt 文档增量翻译系统 (Hy-MT2-1.8B 本地模型)

特性：
1. 内容哈希缓存：只翻译新增/变化的 .md 文件，官方 git pull 后未变的直接跳过
2. 术语表统一：composable/tree-shaking 等术语强制一致
3. MDC 组件 title 属性翻译：:read-more{title="..."} 的英文标题一并翻译
4. 图片自动下载：译文引用的 /assets/... 自动抓到站点 public/
5. 断点续传 + 进度显示：支持按章节/单个文件运行，失败可重跑

用法：
  python incremental.py --chapter 1.getting-started     # 翻某一章
  python incremental.py --all                            # 全量（263篇）
  python incremental.py --force                          # 忽略缓存强制重翻
  python incremental.py --stats                          # 只看统计，不翻译
"""
import sys, json, re, urllib.request, hashlib, argparse, time
from pathlib import Path

BASE     = Path("D:/hy-mt2-bench/nuxt-docs")       # 仓库根
ROOT     = BASE / "nuxt"                            # Nuxt 项目目录（整理后）
SRC_BASE = BASE / "repo/docs"                       # 英文源（git 仓库，共享源材料仍在仓库根）
DST_BASE = ROOT / "site/content"                    # 译文输出（Docus content）
CACHE    = ROOT / "cache.json"                      # 哈希缓存
PUBLIC   = ROOT / "site/public"                     # 静态资源
API      = "http://127.0.0.1:8999/v1/chat/completions"
SITE_ORIGIN = "https://nuxt.com"

# 术语表：译文里若残留英文，统一替换为规范译法（在翻译后处理）
TERMS = {
    "composable": "组合式函数", "composables": "组合式函数",
    "tree-shaking": "摇树优化", "middleware": "中间件",
    "server-side rendering": "服务端渲染", "client-side rendering": "客户端渲染",
    "hot module replacement": "热模块替换",
}

SYS = (
    "你是专业的技术文档翻译引擎。把用户给出的每一段英文技术文档翻译成简体中文。\n"
    "硬性规则：\n"
    "1. 输入包含多个用 <##数字> 开头标记的段落，你必须为每一段输出译文，并保留同样的 <##数字> 标记，顺序不变，一段不漏。\n"
    "2. 绝对不要修改、翻译或删除任何 Markdown / MDC 标记：**加粗**、`行内代码`、[链接文本](url)、花括号内属性、::组件名。链接文本可译，url 和花括号内属性里的 title 值除外（见规则5）。\n"
    "3. `行内代码`、文件路径、目录名（如 app/pages/）、组件名（NuxtPage）、命令、代码、技术术语（SSR、HMR、TypeScript、Vite、Nitro、tree-shaking）保持原样不译。\n"
    "4. 不要增删信息，不要加解释，不要合并或拆分段落。只输出译文，不要输出原文或评论。\n"
    "5. [重要] 以英文冒号开头的行（如 :read-more{...} 或 ::tip）是 MDC 组件标记，绝对不要翻译、不要输出、不要包含在译文里。系统会单独处理它们。\n"
    "6. composable 译为“组合式函数”，tree-shaking 译为“摇树优化”。\n"
)

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def call_llm(blocks, retries=3):
    """blocks: [(idx, text)]; 返回 {idx: translated}"""
    parts = [f"<##{i}>\n{t}" for i, t in blocks]
    payload = json.dumps({
        "messages": [{"role": "system", "content": SYS},
                     {"role": "user", "content": "\n\n".join(parts)}],
        "temperature": 0.1, "top_k": 50, "repeat_penalty": 1.05,
        "max_tokens": 4096,
    }).encode("utf-8")
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API, data=payload,
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.loads(r.read())
            text = data["choices"][0]["message"]["content"]
            out, cur = {}, None
            for line in text.split("\n"):
                m = re.match(r"\s*<##(\d+)>\s*$", line)
                if m:
                    cur = int(m.group(1)); out[cur] = []; continue
                m2 = re.match(r"\s*<##(\d+)>\s*(.*)$", line)
                if m2:
                    cur = int(m2.group(1)); out[cur] = [m2.group(2)]; continue
                if cur is not None:
                    out[cur].append(line)
            return {k: "\n".join(v).strip() for k, v in out.items()}
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"LLM 调用失败（重试 {retries} 次）: {last}")

def translate_titles(pairs):
    """单独翻译 MDC 的 title 短语。pairs: [(key, english_phrase)] -> {key: chinese}"""
    payload = json.dumps({
        "messages": [
            {"role": "system", "content":
             "把下列每个英文短语翻译成简短的中文标题。只输出译文本身，不要解释、不要加引号、不要输出 <##编号> 以外的任何东西。"
             "每个短语用 <##数字> 标记开头，输出时保留同样的标记，一一对应。"},
            {"role": "user", "content": "\n".join(f"<##{k}>\n{t}" for k, t in pairs)},
        ],
        "temperature": 0.1, "max_tokens": 1024,
    }).encode("utf-8")
    for attempt in range(3):
        try:
            req = urllib.request.Request(API, data=payload,
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            text = data["choices"][0]["message"]["content"]
            out, cur = {}, None
            for line in text.split("\n"):
                m = re.match(r"\s*<##(\d+)>\s*$", line)
                if m: cur = int(m.group(1)); out[cur] = []; continue
                m2 = re.match(r"\s*<##(\d+)>\s*(.*)$", line)
                if m2: cur = int(m2.group(1)); out[cur] = [m2.group(2)]; continue
                if cur is not None: out[cur].append(line)
            return {k: "\n".join(v).strip() for k, v in out.items()}
        except Exception:
            time.sleep(2 * (attempt + 1))
    return {}

def post_process(text: str) -> str:
    """术语兜底替换（只在中文译文里残留英文术语时）"""
    for en, zh in TERMS.items():
        # 跳过被 ` 包裹的行内代码
        parts = text.split("`")
        for i in range(0, len(parts), 2):   # 偶数段是非代码区
            parts[i] = re.sub(rf"\b{re.escape(en)}\b", zh, parts[i], flags=re.I)
        text = "`".join(parts)
    return text

def download_images(translated_text: str):
    """把译文里引用的 /assets/... 图片下载到 public/（含 IPX 路径兜底）"""
    paths = re.findall(r"!\[[^\]]*\]\((/assets/[^)]+)\)", translated_text)
    saved = []
    for p in set(paths):
        dst = PUBLIC / p.lstrip("/")
        if dst.exists():
            continue
        try:
            req = urllib.request.Request(SITE_ORIGIN + p,
                headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(data)
            saved.append(p)
        except Exception as e:
            print(f"    [图片下载失败] {p}: {e}", file=sys.stderr)
    return saved

def translate_md(src: Path, dst: Path):
    lines = src.read_text(encoding="utf-8").split("\n")
    out_lines, translatable = [], []
    in_code = False
    fm_end = None
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() == "---":
                fm_end = j; break
    fm_range = (0, fm_end) if fm_end is not None else None

    for idx, line in enumerate(lines):
        s = line.strip()
        if s.startswith("```"):
            in_code = not in_code; out_lines.append(line); continue
        if in_code:
            out_lines.append(line); continue
        # 空的纯结构行、注释、frontmatter 结束符、图片行、纯 MDC 指令行：原样
        if (not s or s.startswith("![") or s.startswith("<!--")
                or (s == "---" and fm_range and idx == fm_range[1])):
            out_lines.append(line); continue
        # MDC 行：整行原样保留，title 值单独提取翻译（不放进批量块，避免破坏结构）
        if s.startswith(":") and not s.startswith("```"):
            out_lines.append(line); continue
        # frontmatter 的 title/description
        if fm_range and fm_range[0] <= idx <= fm_range[1]:
            m = re.match(r"^(title|description):\s*(.+)$", line)
            if m and re.search(r"[A-Za-z]", m.group(2)):
                translatable.append((idx, m.group(2).strip().strip("'\"")))
            out_lines.append(line); continue
        # 正文散文
        if re.search(r"[A-Za-z]", line):
            translatable.append((idx, line))
        out_lines.append(line)

    # 分批翻译
    groups, cur, size = [], [], 0
    for item in translatable:
        size += len(item[1]); cur.append(item)
        if size > 2200:
            groups.append(cur); cur = []; size = 0
    if cur: groups.append(cur)

    translations = {}
    for g in groups:
        res = call_llm([(str(k), v) for k, v in g])
        for k, v in res.items():
            translations[int(k)] = v

    # 回填正文/frontmatter（MDC 行原样，不动）
    for out_i, txt in translations.items():
        line = lines[out_i]
        if fm_range and fm_range[0] <= out_i <= fm_range[1]:
            m = re.match(r"^(title|description):\s*(.+)$", line)
            if m:
                out_lines[out_i] = f"{m.group(1)}: {txt}"
            continue
        s = line.strip()
        if s.startswith(":"):
            continue  # MDC 行下面单独处理
        m = re.match(r"^(\s*(?:[-*]\s+|#{1,6}\s+|>\s+)?)", line)
        prefix = m.group(1) if m else ""
        body = re.sub(r"^(?:#{1,6}|[-*>+])\s+", "", txt.lstrip())
        out_lines[out_i] = prefix + post_process(body)

    # 单独处理 MDC 行的 title="英文"：只翻译引号内的短语，精确回填
    mdc_titles = []  # (line_idx, english_title)
    for idx, line in enumerate(out_lines):
        if line.strip().startswith(":"):
            tm = re.search(r'title="([^"]*[A-Za-z][^"]*)"', line)
            if tm:
                mdc_titles.append((idx, tm.group(1)))
    if mdc_titles:
        title_map = translate_titles([(k, t) for k, (_, t) in enumerate(mdc_titles)])
        for k, (line_idx, eng) in enumerate(mdc_titles):
            zh = title_map.get(k, eng).strip().strip('"').strip("'")
            # 防御：模型若返回了带 = 或 : 的脏数据，放弃替换，保留原文
            if "=" in zh or "read-more" in zh or len(zh) > 30:
                zh = eng
            out_lines[line_idx] = out_lines[line_idx].replace(f'title="{eng}"', f'title="{zh}"', 1)

    result = "\n".join(out_lines)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(result, encoding="utf-8")
    return len(translations), result

def load_cache():
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}

def save_cache(cache):
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

def collect_files(chapter=None):
    files = sorted(SRC_BASE.rglob("*.md"))
    if chapter:
        files = [f for f in files if f.relative_to(SRC_BASE).parts[0] == chapter]
    return files

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chapter", help="只翻译某章，如 1.getting-started")
    ap.add_argument("--file", help="只翻译单个文件，如 1.getting-started/01.introduction.md")
    ap.add_argument("--all", action="store_true", help="翻译全部")
    ap.add_argument("--force", action="store_true", help="忽略缓存强制重翻")
    ap.add_argument("--stats", action="store_true", help="只显示统计")
    ap.add_argument("--prune", action="store_true", help="清理源文件已不存在的旧译文")
    args = ap.parse_args()

    cache = load_cache()
    if args.file:
        files = [SRC_BASE / args.file]
    else:
        files = collect_files(args.chapter if args.chapter else None)
    total = len(files)

    # 清理源已不存在的旧译文（移到 _pruned 备份，避免环境删除拦截）
    if args.prune:
        import shutil
        src_set = {f.relative_to(SRC_BASE).as_posix() for f in SRC_BASE.rglob("*.md")}
        pruned = ROOT / "_pruned" / time.strftime("%Y%m%d_%H%M%S")
        n = 0
        for dst in sorted(DST_BASE.rglob("*.md")):
            rel = dst.relative_to(DST_BASE).as_posix()
            if rel not in src_set:
                target = pruned / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(dst), str(target))
                cache.pop(rel, None)
                n += 1
        save_cache(cache)
        print(f"[prune] 已移走 {n} 篇源已不存在的旧译文 -> {pruned}", file=sys.stderr)

    # 统计模式
    if args.stats:
        cached = sum(1 for f in files if f.relative_to(SRC_BASE).as_posix() in cache
                     and cache[f.relative_to(SRC_BASE).as_posix()].get("hash") == sha256(f))
        print(f"章节: {args.chapter or '全部'} | 总文件: {total} | 已缓存(未变): {cached} | 待翻: {total-cached}")
        return

    if not args.chapter and not args.all and not args.file:
        print("请指定 --chapter <章节> / --file <文件> / --all（或用 --stats 查看统计）")
        return

    todo = []
    for f in files:
        rel = f.relative_to(SRC_BASE).as_posix()
        h = sha256(f)
        if not args.force and cache.get(rel, {}).get("hash") == h \
                and (DST_BASE / rel).exists():
            continue
        todo.append((f, rel, h))

    print(f"待翻译: {len(todo)} / {total} 篇", file=sys.stderr)
    ok = fail = 0
    for i, (src, rel, h) in enumerate(todo, 1):
        dst = DST_BASE / rel
        print(f"[{i}/{len(todo)}] {rel}", file=sys.stderr)
        try:
            n, text = translate_md(src, dst)
            imgs = download_images(text)
            cache[rel] = {"hash": h, "blocks": n, "time": time.strftime("%Y-%m-%d %H:%M")}
            save_cache(cache)   # 每篇都存，断点续传
            ok += 1
            print(f"    ✓ {n} 段" + (f" + {len(imgs)} 图" if imgs else ""), file=sys.stderr)
        except Exception as e:
            fail += 1
            print(f"    ✗ 失败: {e}", file=sys.stderr)
    print(f"\n完成: 成功 {ok}, 失败 {fail}, 跳过(未变) {total-len(todo)}", file=sys.stderr)

if __name__ == "__main__":
    main()
