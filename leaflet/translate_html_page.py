#!/usr/bin/env python3
"""精准翻译官网页面 HTML：只翻译可见文本节点，保留所有标签/属性/结构/脚本/地图。
用法: python translate_html_page.py <官网html> <输出html>
"""
import re, sys, json, time, html as htmlmod, urllib.request
from pathlib import Path

API = "http://127.0.0.1:8999/v1/chat/completions"
MODEL = "Hy-MT2-1.8B-Q4_K_M.gguf"
SYS = """你是技术文档翻译助手。把用户给出的每一段英文逐段翻译成中文。规则：
1. 保留每段前面的 <##数字> 标记，一段都不能少、不能乱序。
2. 技术术语、产品名、API 名、代码、数字、URL 保持英文原样不译。
3. 只翻译自然语言描述，译文简洁准确、符合中文技术文档习惯。
4. 不要添加任何解释或额外文字，只输出带标记的译文。
5. 每段译文保持单行，不要换行。"""

# 这些标签内部的内容整体跳过（代码/脚本/样式）
SKIP_TAGS = {"script", "style", "pre", "code", "svg"}

def extract_text_nodes(main):
    """提取需要翻译的文本片段。返回 [(key, text)] 和替换占位映射。
    做法：用占位符替换每个文本节点，翻译后再换回。"""
    segments = []
    placeholders = {}
    idx = [0]

    def repl_text(match):
        """匹配 >文本< 之间的纯文本（含实体）。"""
        full = match.group(0)
        gt, txt, lt = full[0], full[1:-1], full[-1]
        stripped = txt.strip()
        # 跳过空、纯实体、纯符号
        if not stripped or re.fullmatch(r'[\s&;#a-zA-Z0-9./:\-_]*', stripped) and not re.search(r'[A-Za-z]{3,}', stripped):
            return full
        # 必须有英文单词（≥2 字母）
        words = re.findall(r'[A-Za-z]{2,}', stripped)
        if len(words) < 2:
            return full
        # 已有中文
        if re.search(r'[一-龥]', stripped):
            return full
        key = idx[0]; idx[0] += 1
        ph = f'\x00PH{key}\x00'
        placeholders[key] = txt  # 保留原始前后空格
        segments.append((key, stripped))
        return gt + ph + lt

    # 分块：跳过 script/style/pre/code/svg 整块
    protected = []
    def stash(m):
        protected.append(m.group(0))
        return f'\x00SKIP{len(protected)-1}\x00'
    work = re.sub(r'<(script|style|pre|code|svg)\b[^>]*>.*?</\1>', stash, main, flags=re.S)

    # 在标签之间的文本上做替换
    work = re.sub(r'>([^<>]+)<', repl_text, work)

    # 恢复跳过的块
    for i, block in enumerate(protected):
        work = work.replace(f'\x00SKIP{i}\x00', block)
    return work, segments, placeholders

def call_llm(segments):
    if not segments: return {}
    batches, cur, cur_len = [], [], 0
    for k, t in segments:
        block = f"<##{k}>\n{t}\n"
        if cur_len + len(block) > 2500 and cur:
            batches.append(cur); cur, cur_len = [], 0
        cur.append((k, t)); cur_len += len(block)
    if cur: batches.append(cur)
    result = {}
    for batch in batches:
        payload_text = "\n".join(f"<##{k}>\n{t}" for k, t in batch)
        payload = json.dumps({
            "model": MODEL,
            "messages": [{"role":"system","content":SYS},{"role":"user","content":payload_text}],
            "temperature":0.1, "top_k":50, "repeat_penalty":1.1, "max_tokens":4096,
        }).encode("utf-8")
        req = urllib.request.Request(API, data=payload, headers={"Content-Type":"application/json"})
        text = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    text = json.loads(resp.read())["choices"][0]["message"]["content"]
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  LLM失败: {e}", file=sys.stderr); return result
                time.sleep(2)
        parts = re.split(r'<##(\d+)>', text)
        keys = dict(batch)
        for j in range(1, len(parts), 2):
            key = int(parts[j])
            val = (parts[j+1] if j+1 < len(parts) else "").strip()
            val = "\n".join(line.strip() for line in val.split("\n") if line.strip())
            if key in keys: result[key] = val
    return result

def main():
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    h = src.read_text(encoding="utf-8", errors="surrogateescape")
    m = re.search(r'(<main[^>]*>)(.*?)(</main>)', h, re.S)
    if not m:
        print("无 main 标签"); return
    before, main_html, after = h[:m.start(2)], m.group(2), h[m.end(2):]
    work, segments, placeholders = extract_text_nodes(main_html)
    print(f"提取 {len(segments)} 个文本节点")
    translated = call_llm(segments)
    # 回填占位符：保留原始前后空白
    for key, orig in placeholders.items():
        zh = translated.get(key)
        if zh is None:
            continue
        lead = orig[:len(orig)-len(orig.lstrip())]
        trail = orig[len(orig.rstrip()):]
        work = work.replace(f'\x00PH{key}\x00', lead + zh + trail)
    out = before + work + after
    dst.write_text(out, encoding="utf-8", errors="surrogateescape")
    print(f"翻译 {len(translated)} 段 -> {dst}")

if __name__ == "__main__":
    main()
