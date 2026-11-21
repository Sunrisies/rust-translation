#!/usr/bin/env python3
"""从 GitHub v1.9.4 tag 下载 Leaflet 源文件（源码 js + 教程 md）。
gh api 走独立认证通道，比 git clone 稳。并发下载。
"""
import json, subprocess, base64, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

TAG = "v1.9.4"
REPO = "Leaflet/Leaflet"
ROOT = Path(__file__).parent / "repo"

def gh_api(path):
    r = subprocess.run(["gh", "api", path], capture_output=True)
    if r.returncode != 0:
        return None
    return r.stdout

def list_tree():
    out = gh_api(f"repos/{REPO}/git/trees/{TAG}?recursive=1")
    data = json.loads(out)
    return [x["path"] for x in data["tree"] if x["type"] == "blob"]

def want(path):
    # API 参考源：src 下所有 js
    if path.startswith("src/") and path.endswith(".js"):
        return True
    # 教程：docs/examples 下所有 md（含子目录），排除插件/博客/顶层页面
    if path.startswith("docs/examples/") and path.endswith(".md"):
        return True
    return False

def fetch_one(path):
    dst = ROOT / path
    if dst.exists() and dst.stat().st_size > 0:
        return path, "skip", dst.stat().st_size
    # contents API 返回 base64（单文件）
    out = gh_api(f"repos/{REPO}/contents/{path}?ref={TAG}")
    if not out:
        return path, "fail", 0
    try:
        obj = json.loads(out)
        content = obj.get("content", "")
        data = base64.b64decode(content)
    except Exception:
        return path, "fail", 0
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(data)
    return path, "ok", len(data)

def main():
    paths = [p for p in list_tree() if want(p)]
    src_js = [p for p in paths if p.startswith("src/")]
    doc_md = [p for p in paths if p.startswith("docs/examples/")]
    print(f"待下载: 源码 {len(src_js)} js + 教程 {len(doc_md)} md = {len(paths)} 文件")
    ok = fail = skip = 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = [ex.submit(fetch_one, p) for p in paths]
        for i, f in enumerate(as_completed(futs), 1):
            path, status, size = f.result()
            if status == "ok": ok += 1
            elif status == "skip": skip += 1
            else:
                fail += 1
                print(f"  FAIL: {path}", file=sys.stderr)
            if i % 20 == 0:
                print(f"  进度 {i}/{len(paths)}", flush=True)
    print(f"完成: 新下 {ok}, 跳过 {skip}, 失败 {fail}")
    print(f"实际文件: js {len(list(ROOT.glob('src/**/*.js')))} / md {len(list(ROOT.glob('docs/examples/**/*.md')))}")

if __name__ == "__main__":
    main()
