#!/usr/bin/env python3
"""并发翻译 Rust 标准库 rustdoc 注释（复用 rustdoc_translator 的核心逻辑）。

ThreadPoolExecutor 并发处理文件（I/O 密集），每个 worker 独立翻译一个文件，
cache 写入用锁保护。并发数默认 6，可根据模型服务承载能力调整。

用法: python translate_parallel.py <std项目目录> [--workers 6] [--limit N]
"""
import json, threading, time, sys, argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import rustdoc_translator as rt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int, default=0, help="只翻前 N 个待翻文件（测试用）")
    args = ap.parse_args()

    proj = Path(args.project).resolve()
    cfg = json.loads((proj / "config.json").read_text(encoding="utf-8"))
    src_root = proj / cfg["src_dir"]
    dst_root = proj / "translated"
    cache_path = proj / "cache.json"
    cache = rt.load_cache(cache_path)

    all_files = sorted(f for f in src_root.rglob("*.rs"))
    todo = [f for f in all_files
            if cache.get(f.relative_to(src_root).as_posix(), {}).get("hash") != rt.sha256(f)]
    if args.limit:
        todo = todo[:args.limit]
    print(f"总 {len(all_files)} 篇, 待翻 {len(todo)} 篇, 并发 {args.workers}", flush=True)
    if not todo:
        return

    lock = threading.Lock()
    ok = fail = 0
    t0 = time.time()
    cache_updates = {}

    def work(src):
        rel = src.relative_to(src_root).as_posix()
        h = rt.sha256(src)
        try:
            n = rt.translate_file(src, dst_root / rel, cfg)
            return rel, h, n, None
        except Exception as e:
            return rel, h, 0, str(e)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(work, f): f for f in todo}
        for i, fu in enumerate(as_completed(futures), 1):
            rel, h, n, err = fu.result()
            if err:
                fail += 1
                print(f"  ✗ {rel}: {err}", file=sys.stderr, flush=True)
            else:
                ok += 1
                with lock:
                    cache_updates[rel] = {"hash": h, "segments": n}
                    cache[rel] = {"hash": h, "segments": n}
                    if i % 5 == 0:
                        rt.save_cache(cache_path, cache)
            if i % 20 == 0 or i == len(todo):
                rate = i / (time.time() - t0) * 60
                eta = (len(todo) - i) / rate if rate else 0
                print(f"  {i}/{len(todo)} ({i/len(todo)*100:.1f}%) | {rate:.1f}篇/分 | 剩余 {int(eta)}分",
                      flush=True)

    rt.save_cache(cache_path, cache)
    print(f"完成: 成功 {ok}, 失败 {fail}, 耗时 {int(time.time()-t0)}秒", flush=True)


if __name__ == "__main__":
    main()
