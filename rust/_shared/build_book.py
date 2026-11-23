#!/usr/bin/env python3
"""用 mdbook 把译文 content/ 构建成中文站。
从各项目 config.json 读标题/语言，从源仓库抓 book.toml 后改中文，构建到 site/。
用法: python build_book.py <项目目录>
"""
import json, subprocess, sys, re, os
from pathlib import Path

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

def build(proj):
    cfg = json.loads((proj / "config.json").read_text(encoding="utf-8"))
    content = proj / "content"
    build_dir = proj / "build"
    site_dir = proj / "site"
    build_dir.mkdir(parents=True, exist_ok=True)

    # 抓源 book.toml，改中文标题和语言
    parent = Path(cfg['src_path']).parent.as_posix()
    toml_path = f"{parent}/book.toml" if parent and parent != "." else "book.toml"
    # 优先 raw（不受匿名 API 限流），失败再退回 API
    toml_text = None
    raw = curl_url(f"https://raw.githubusercontent.com/{cfg['repo']}/{cfg['branch']}/{toml_path}")
    if raw and not raw.strip().startswith(b"404"):
        toml_text = raw.decode("utf-8")
    else:
        toml = gh_api(f"repos/{cfg['repo']}/contents/{toml_path}?ref={cfg['branch']}")
        import base64
        if toml:
            try:
                toml_text = base64.b64decode(json.loads(toml).get("content", "")).decode("utf-8")
            except Exception:
                toml_text = None
    if not toml_text:
        toml_text = '[book]\ntitle = "Documentation"\n[output.html]\n'
    toml_text = re.sub(r'(?m)^title\s*=.*$', f'title = "{cfg["title"]}"', toml_text if 'title =' in toml_text else '[book]\ntitle = "x"\n' + toml_text)
    toml_text = re.sub(r'(?m)^language\s*=.*$', 'language = "zh-CN"', toml_text)
    # 过滤掉依赖外部主题/文件的配置（我们没下载 theme/ 等），避免构建失败
    cleaned = []
    skip_section = None
    for line in toml_text.split("\n"):
        st = line.strip()
        if st.startswith("[") and st.endswith("]"):
            skip_section = st
        # 跳过 additional-css/js、preprocessor、redirect 整段
        if st.startswith(("additional-css", "additional-js", "preprocessor")):
            continue
        if skip_section in ("[output.html.redirect]", "[preprocessor.foo]"):
            if st.startswith("[") and st != skip_section:
                skip_section = None
            else:
                continue
        cleaned.append(line)
    toml_text = "\n".join(cleaned)
    # 清掉 playground/site-url 等指向英文站的配置（保留也能用，但 playground 英文示例无妨）
    (build_dir / "book.toml").write_text(toml_text, encoding="utf-8")

    # 复制译文到 build/src
    import shutil
    src_dir = build_dir / "src"
    if src_dir.exists(): shutil.rmtree(src_dir)
    shutil.copytree(content, src_dir)

    # 构建
    r = subprocess.run(["mdbook", "build", str(build_dir), "-d", str(site_dir)],
                       capture_output=True, text=True)
    print(r.stdout[-2000:])
    if r.returncode != 0:
        print("构建失败:", r.stderr[-2000:], file=sys.stderr)
        return
    print(f"[{cfg['name']}] 构建完成: {len(list(site_dir.rglob('*.html')))} HTML -> {site_dir}")

if __name__ == "__main__":
    build(Path(sys.argv[1]).resolve())
