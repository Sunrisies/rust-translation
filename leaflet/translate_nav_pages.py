#!/usr/bin/env python3
"""翻译官网导航页（Overview / Tutorials / Install）的正文。
从官网 HTML 提取 <main> 里的可见文本段落，翻译后生成中文 HTML 片段。
- examples 用 1.9 版（examples-v1.html）
- index/install 用当前版（内容与版本关系不大）
"""
import re, json, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
PAGES = ROOT / "official-pages"
OUT = ROOT / "nav-translated"
OUT.mkdir(exist_ok=True)
API = "http://127.0.0.1:8999/v1/chat/completions"
MODEL = "Hy-MT2-1.8B-Q4_K_M.gguf"

SYS = """你是技术文档翻译助手。把用户给出的每一段英文逐段翻译成中文。规则：
1. 保留每段前面的 <##数字> 标记，一段都不能少、不能乱序。
2. 技术术语、API 名称、产品名、代码、链接、版本号保持英文原样不译。
3. 只翻译自然语言描述，译文简洁准确、符合中文技术文档习惯。
4. 不要添加任何解释或额外文字，只输出带标记的译文。
5. 每段译文保持单行，不要换行。"""

def extract_text(html):
    """从官网 main 提取结构化段落：h1/h2/p/li，保留标签类型。"""
    m = re.search(r'<main[^>]*>(.*?)</main>', html, re.S)
    body = m.group(1) if m else ""
    # 去 script/style
    body = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', body, flags=re.S)
    items = []
    # 逐块提取 h1/h2/h3/p/li
    for tag in ['h1','h2','h3','p','li']:
        for mm in re.finditer(rf'<{tag}[^>]*>(.*?)</{tag}>', body, re.S):
            inner = re.sub(r'<[^>]+>', '', mm.group(1))
            inner = re.sub(r'\s+', ' ', inner).strip()
            if not inner:
                continue
            # 跳过纯数字/符号/代码
            if len(re.findall(r'[A-Za-z]{2,}', inner)) < 2:
                continue
            items.append((tag, inner, mm.start()))
    # 按位置排序
    items.sort(key=lambda x: x[2])
    # 去重（同样的文本只留一次）
    seen = set(); uniq = []
    for tag, txt, pos in items:
        if txt in seen: continue
        seen.add(txt); uniq.append((tag, txt))
    return uniq

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
            "temperature":0.1, "top_k":50, "repeat_penalty":1.1, "max_tokens":2048,
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
                    print(f"  LLM失败: {e}", file=__import__('sys').stderr); return result
                time.sleep(2)
        parts = re.split(r'<##(\d+)>', text)
        keys = dict(batch)
        for j in range(1, len(parts), 2):
            key = int(parts[j])
            val = " ".join((parts[j+1] if j+1 < len(parts) else "").split())
            if key in keys: result[key] = val
    return result

def main():
    for name, src in [("index","index.html"), ("tutorials","examples-v1.html"), ("install","install.html")]:
        html = (PAGES / src).read_text(encoding="utf-8", errors="ignore")
        items = extract_text(html)
        print(f"{name}: 提取 {len(items)} 段")
        translated = call_llm([(i, t) for i, (_, t) in enumerate(items)])
        # 生成 HTML 片段（保留原标签类型）
        out = []
        for i, (tag, orig) in enumerate(items):
            zh = translated.get(i, orig)
            out.append(f"<{tag}>{zh}</{tag}>")
        (OUT / f"{name}.html").write_text("\n".join(out), encoding="utf-8")
        print(f"  译文已存: {len(translated)} 段翻译")

if __name__ == "__main__":
    main()
