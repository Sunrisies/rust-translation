#!/usr/bin/env python3
"""从 GitHub 拉某本书的 md 源文件（gh API，比 git clone 稳）。
用法: python fetch_book.py <项目目录>
配置从该目录的 config.json 读：repo / branch / src_path
"""
import json, subprocess, base64, sys, os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

PROXY = os.environ.get("HTTPS_PROXY") or "http://127.0.0.1:7897"

def curl_url(url):
    env = dict(os.environ, HTTPS_PROXY=PROXY, HTTP_PROXY=PROXY)
    r = subprocess.run(["curl", "-sL", "-m", "60", url], capture_output=True, env=env)
    return r.stdout if r.returncode == 0 else None

def gh_api(path):
    r = subprocess.run(["gh", "api", path], capture_output=True)
    if r.returncode == 0 and r.stdout:
        return r.stdout
    return curl_url("https://api.github.com/" + path)

def fetch_book(proj):
    cfg = json.loads((proj / "config.json").read_text(encoding="utf-8"))
    repo, branch, src_path = cfg["repo"], cfg["branch"], cfg["src_path"]
    dest = proj / cfg["src_dir"]
    tree = gh_api(f"repos/{repo}/git/trees/{branch}?recursive=1")
    if not tree:
        print(f"无法获取 tree: {repo}"); return
    paths = [x["path"] for x in json.loads(tree)["tree"]
             if x["type"] == "blob" and x["path"].startswith(src_path + "/") and x["path"].endswith(".md")]
    print(f"[{cfg['name']}] 待下载 {len(paths)} 篇 md")
    def one(p):
        out = dest / p[len(src_path)+1:]  # 去掉 src_path 前缀
        if out.exists() and out.stat().st_size > 0:
            return "skip"
        # 优先用 raw.githubusercontent.com（不限流），gh 失效时避免 API 限流
        content = curl_url(f"https://raw.githubusercontent.com/{repo}/{branch}/{p}")
        if not content or content.startswith(b"404: Not Found"):
            data = gh_api(f"repos/{repo}/contents/{p}?ref={branch}")
            if not data: return "fail"
            try:
                content = base64.b64decode(json.loads(data).get("content", ""))
            except Exception:
                return "fail"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(content)
        return "ok"
    ok = skip = fail = 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        for i, f in enumerate(as_completed([ex.submit(one, p) for p in paths]), 1):
            r = f.result()
            ok += r == "ok"; skip += r == "skip"; fail += r == "fail"
            if i % 10 == 0: print(f"  进度 {i}/{len(paths)}", flush=True)
    print(f"完成: 新下 {ok}, 跳过 {skip}, 失败 {fail}")
    print(f"实际文件: {len(list(dest.rglob('*.md')))} 篇")

if __name__ == "__main__":
    fetch_book(Path(sys.argv[1]).resolve())
