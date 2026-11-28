#!/usr/bin/env python3
"""从 rust-lang/rust main 分支拉取标准库 core/alloc/std/proc_macro 的 .rs 源文件。

用 gh api 拿 tree（已登录，不受匿名限流），raw.githubusercontent.com 下载内容（不限流）。
用法: python fetch_std.py <std项目目录>
"""
import json, subprocess, sys, os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

PROXY = os.environ.get("HTTPS_PROXY") or "http://127.0.0.1:7897"
CRATES = ("core", "alloc", "std", "proc_macro")


def gh_api(path):
    r = subprocess.run(["gh", "api", path], capture_output=True)
    return r.stdout if r.returncode == 0 else None


def curl_raw(repo, branch, rel):
    env = dict(os.environ, HTTPS_PROXY=PROXY, HTTP_PROXY=PROXY)
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/{rel}"
    r = subprocess.run(["curl", "-sL", "-m", "60", url], capture_output=True, env=env)
    out = r.stdout if r.returncode == 0 else None
    if out and out.startswith(b"404: Not Found"):
        return None
    return out


def main():
    proj = Path(sys.argv[1]).resolve()
    cfg = json.loads((proj / "config.json").read_text(encoding="utf-8"))
    repo, branch = cfg["repo"], cfg["branch"]
    dest = proj / cfg["src_dir"]
    dest.mkdir(parents=True, exist_ok=True)

    print(f"[{cfg['name']}] 拉取 tree ...", flush=True)
    tree_raw = gh_api(f"repos/{repo}/git/trees/{branch}?recursive=1")
    if not tree_raw:
        print("tree 拉取失败"); sys.exit(1)
    tree = json.loads(tree_raw)
    paths = []
    for item in tree["tree"]:
        p = item["path"]
        if item["type"] == "blob" and p.endswith(".rs"):
            parts = p.split("/")
            if len(parts) >= 3 and parts[0] == "library" and parts[1] in CRATES:
                paths.append(p)
    print(f"找到 {len(paths)} 个源文件", flush=True)

    def one(p):
        parts = p.split("/")
        rel = "/".join(parts[2:])          # 去掉 library/<crate>/
        out = dest / parts[1] / rel        # 按 crate 分目录，避免同名覆盖
        if out.exists() and out.stat().st_size > 0:
            return "skip"
        content = curl_raw(repo, branch, p)
        if not content:
            return "fail"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(content)
        return "ok"

    ok = skip = fail = 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(one, p): p for p in paths}
        for i, f in enumerate(as_completed(futures), 1):
            r = f.result()
            if r == "ok": ok += 1
            elif r == "skip": skip += 1
            else:
                fail += 1
                print(f"  失败: {futures[f]}", flush=True)
            if i % 100 == 0:
                print(f"  进度 {i}/{len(paths)}", flush=True)
    actual = len(list(dest.rglob("*.rs")))
    print(f"完成: 新下 {ok}, 跳过 {skip}, 失败 {fail}; 实际文件 {actual} 篇")


if __name__ == "__main__":
    main()
