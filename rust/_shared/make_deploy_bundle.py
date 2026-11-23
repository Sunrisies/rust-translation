#!/usr/bin/env python3
"""组装统一部署包：门户首页 + 五本书到各自子目录，供 /clippy/ 等路径访问。

输出目录 deploy/：
  deploy/index.html          门户
  deploy/book/...            Rust 程序设计语言
  deploy/cargo/...           Cargo 使用指南
  deploy/reference/...       Rust 参考手册
  deploy/clippy/...          Clippy 文档
  deploy/error-codes/...     Rust 错误码说明

用法: python make_deploy_bundle.py <rust根目录>
"""
import shutil, sys
from pathlib import Path

BOOKS = ["book", "cargo", "reference", "clippy", "error-codes"]


def main():
    root = Path(sys.argv[1]).resolve()
    deploy = root / "deploy"
    if deploy.exists():
        shutil.rmtree(deploy)
    deploy.mkdir()
    # 门户首页
    shutil.copy2(root / "index.html", deploy / "index.html")
    # 五本书
    for b in BOOKS:
        src = root / b / "site"
        if not src.exists():
            print(f"[跳过] {b}");
            continue
        shutil.copytree(src, deploy / b)
        n = len(list((deploy / b).rglob("*.html")))
        print(f"[打包] {b}: {n} 页 -> deploy/{b}/")
    print(f"部署包完成: {deploy}  (共 {len(list(deploy.rglob('*.html')))} HTML)")


if __name__ == "__main__":
    main()
