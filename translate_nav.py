#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""翻译 content 下 .navigation.yml 的 title / titleTemplate，保留其余字段。"""
from pathlib import Path
import re

DST = Path("D:/hy-mt2-bench/nuxt-docs/site/content")

# 精确映射（title 值 -> 中文）
TITLE = {
    "Docs": "文档",
    "Get Started": "入门指南",
    "Directory Structure": "目录结构",
    "app": "app",
    "Guide": "指南",
    "Key Concepts": "核心概念",
    "Best Practices": "最佳实践",
    "Working with AI": "与 AI 协作",
    "Module Author Guide": "模块开发指南",
    "Recipes": "实用教程",
    "Going Further": "进阶",
    "API": "API",
    "Components": "组件",
    "Composables": "组合式函数",
    "Utils": "工具函数",
    "Nuxt Kit": "Nuxt Kit",
    "Community": "社区",
    "Migrate to Nuxt Bridge": "迁移到 Nuxt Bridge",
    "Migrate to Nuxt 3": "迁移到 Nuxt 3",
    "Errors": "错误",
}

def zh_ttpl(s: str) -> str:
    """titleTemplate 里的固定英文片段翻中文，保留 %s 和结构符号。"""
    repl = [
        ("Get Started with Nuxt", "Nuxt 入门指南"),
        ("Nuxt Directory Structure", "Nuxt 目录结构"),
        ("Nuxt Concepts", "Nuxt 核心概念"),
        ("Best Practices", "最佳实践"),
        ("Working with AI", "与 AI 协作"),
        ("Nuxt Modules Author Guide", "Nuxt 模块开发指南"),
        ("Recipes", "实用教程"),
        ("Nuxt Advanced", "Nuxt 进阶"),
        ("Nuxt Components", "Nuxt 组件"),
        ("Nuxt Composables", "Nuxt 组合式函数"),
        ("Nuxt Utils", "Nuxt 工具函数"),
        ("Nuxt Community", "Nuxt 社区"),
        ("Nuxt Errors", "Nuxt 错误"),
        ("Migrate to Nuxt Bridge", "迁移到 Nuxt Bridge"),
        ("Migrate to Nuxt 3", "迁移到 Nuxt 3"),
    ]
    out = s.strip().strip("'\"")
    for en, zh in repl:
        out = out.replace(en, zh)
    return f"'{out}'"

def title_value(raw: str) -> str:
    v = raw.strip().strip("'\"")
    return TITLE.get(v, v)

def main():
    n = 0
    for f in DST.rglob(".navigation.yml"):
        lines = f.read_text(encoding="utf-8").split("\n")
        out = []
        for line in lines:
            m = re.match(r"^(\s*)(title|titleTemplate):\s*(.+)$", line)
            if not m:
                out.append(line); continue
            indent, key, val = m.groups()
            if key == "title":
                out.append(f"{indent}title: {title_value(val)}")
            else:
                out.append(f"{indent}titleTemplate: {zh_ttpl(val)}")
        f.write_text("\n".join(out), encoding="utf-8")
        n += 1
    print(f"已翻译 {n} 个 .navigation.yml")

if __name__ == "__main__":
    main()
