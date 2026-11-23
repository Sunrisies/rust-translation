#!/usr/bin/env python3
"""为 Error Codes（无 SUMMARY.md 的散装 md）生成 mdBook 索引页。
按 E0xxx/E1xxx... 前两位分组，生成 SUMMARY.md + index.md。
用法: python make_index.py <项目目录>
"""
import json, re, sys
from pathlib import Path

def main():
    proj = Path(sys.argv[1]).resolve()
    cfg = json.loads((proj / "config.json").read_text(encoding="utf-8"))
    content = proj / "content"
    # 只收 E0001 这种 E+4位数字 的错误码文件，排除分组页 E00.md 与 index/SUMMARY
    files = sorted(f for f in content.glob("E*.md")
                   if re.fullmatch(r'E\d{4}', f.stem))
    if not files:
        print("无 E*.md 文件"); return
    # 按 E0/E1/E2... 分组（前两位）
    groups = {}
    for f in files:
        code = f.stem
        # 错误码都是 E0xxx，按前 3 位分组（E00/E01/.../E08），每组 7-94 个
        g = code[:3] if len(code) >= 5 and code[2].isdigit() else "说明"
        groups.setdefault(g, []).append(code)
    # 生成 SUMMARY.md
    summary = ["# Summary", "", "[首页](index.md)", ""]
    for g in sorted(groups):
        cnt = len(groups[g])
        summary.append(f"- [{g}x 系列（{cnt} 个）]({g}.md)")
        # 每个错误码作为子项列出，mdbook 才会生成对应 HTML 页面
        for code in groups[g]:
            summary.append(f"    - [{code}]({code}.md)")
    (content / "SUMMARY.md").write_text("\n".join(summary) + "\n", encoding="utf-8")

    # 分组页：列出该组所有错误码链接 + 从译文首行提取简短描述
    for g, codes in groups.items():
        lines = [f"# {g}x 系列错误码", "", f"共 {len(codes)} 个错误码。", ""]
        for code in codes:
            f = content / f"{code}.md"
            txt = f.read_text(encoding="utf-8", errors="surrogateescape")
            # 取第一个非标题、非空行作为描述
            desc = ""
            for line in txt.split("\n"):
                s = line.strip()
                if s and not s.startswith("#"):
                    desc = re.sub(r'[`*\[\]]', '', s)[:80]
                    break
            lines.append(f"- [{code}]({code}.md) — {desc}")
        (content / f"{g}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # 首页
    idx = ["# Rust 错误码说明（中文）", "",
           f"本地 Hy-MT2-1.8B 模型翻译 · 共 {len(files) - 1} 个错误码。", "",
           "编译报错时按错误码查这里，了解「为什么错、怎么改」。", "",
           "## 按系列浏览", ""]
    for g in sorted(groups):
        idx.append(f"- [{g}x 系列（{len(groups[g])} 个）]({g}.md)")
    (content / "index.md").write_text("\n".join(idx) + "\n", encoding="utf-8")
    print(f"索引生成完成: {len(groups)} 组, {len(files)} 个错误码")

if __name__ == "__main__": main()
