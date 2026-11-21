#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通过 gh API 并发下载 Cesium 文档源文件（JSDoc 源：engine/widgets 的 Source/*.js）
只下载生成 API 文档需要的 985 个 js，不下载整个仓库（几百MB）。
"""
import json, subprocess, base64, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("D:/hy-mt2-bench/cesium-docs")
SRC = ROOT / "repo"          # 下载的源码（只含文档源 js）
REF = "main"

def gh_api(path):
    """调用 gh api，返回解析后的 JSON"""
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:200])
    return json.loads(r.stdout)

def get_tree():
    data = gh_api(f"repos/CesiumGS/cesium/git/trees/{REF}?recursive=1")
    paths = []
    for item in data.get("tree", []):
        p = item.get("path", "")
        if (p.startswith("packages/engine/Source/") or p.startswith("packages/widgets/Source/")) \
                and p.endswith((".js", ".jsdoc")) \
                and "/ThirdParty/" not in p and "/Workers/" not in p:
            paths.append(p)
    return sorted(paths)

def download_one(path):
    """下载单个文件（用 contents API 的 content 字段，base64）"""
    dst = SRC / path
    if dst.exists() and dst.stat().st_size > 0:
        return path, True  # 已下载，跳过
    try:
        r = subprocess.run(
            ["gh", "api", f"repos/CesiumGS/cesium/contents/{path}?ref={REF}", "--jq", ".content"],
            capture_output=True, text=True, timeout=60)
        if r.returncode != 0 or not r.stdout.strip():
            return path, False
        content = r.stdout.strip().replace("\n", "")
        data = base64.b64decode(content)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
        return path, True
    except Exception:
        return path, False

def main():
    print("[1/2] 获取文件树...", file=sys.stderr)
    paths = get_tree()
    print(f"  需下载 {len(paths)} 个文档源文件", file=sys.stderr)

    print("[2/2] 并发下载...", file=sys.stderr)
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(download_one, p): p for p in paths}
        for i, f in enumerate(as_completed(futures), 1):
            path, success = f.result()
            if success: ok += 1
            else:
                fail += 1
                print(f"  失败: {path}", file=sys.stderr)
            if i % 100 == 0:
                print(f"  进度 {i}/{len(paths)} (成功{ok}/失败{fail})", file=sys.stderr)

    print(f"\n完成: 成功 {ok}, 失败 {fail}", file=sys.stderr)

if __name__ == "__main__":
    main()
