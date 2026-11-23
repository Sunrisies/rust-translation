# AGENTS.md — AI Agent 操作手册（本地模型文档翻译系统）

> 本文档面向 AI agent：给下一个接手本项目的 AI 提供上下文、约定和操作流程。
> 面向人的文档见 `README.md`；换电脑迁移见 `更换电脑迁移指南.md`；各项目细节见各自的 `部署说明.md`。
> 只记录已确认事实，不确定处标注「待确认」，不要凭猜测修改配置。

---

## 1. 项目是什么

用**本地 Hy-MT2-1.8B 模型**（OpenAI 兼容 API，端口 8999）把四套开源框架官方文档翻译成中文，
并构建成与官网同款的静态文档站，发布到自有服务器。官方更新后只翻译变化的部分。

四套文档及线上地址：

| 项目 | 版本 | 工作目录 | 译文位置 | 线上 |
|---|---|---|---|---|
| Nuxt | v4.6.4 | `nuxt/` | `nuxt/site/content/` | nuxt.sunrise1024.top |
| Cesium | v1.147.0 | `cesium/`（实际在 `D:/hy-mt2-bench/cesium-docs/`） | `cesium/translated/` | cesium.sunrise1024.top |
| Leaflet | v1.9.4 | `leaflet/`（实际在 `D:/hy-mt2-bench/leaflet-docs/`） | `leaflet/translated/` | leaflet.sunrise1024.top |
| Rust 五本书 | 官方最新版 | `rust/` | `rust/*/content/` | rust.sunrise1024.top |

仓库：`Sunrisies/rust-translation`，分支 `docs-translation`（孤儿分支，与 main 隔离）。

---

## 2. 环境前提（动手前先确认）

```bash
curl http://127.0.0.1:8999/v1/models        # 模型服务：应含 Hy-MT2-1.8B-Q4_K_M.gguf
python --version                             # 3.13.x
which mdbook && mdbook --version             # v0.5.4（Rust 构建必需）
gh auth status                               # 账号 Sunrisies
```

- 模型服务按需启动，不在时运行：
  ```bash
  cd /d/hy-mt2-bench
  ./cuda/llama-server.exe -m Hy-MT2-1.8B-Q4_K_M.gguf --host 127.0.0.1 --port 8999 -ngl 99 -c 4096 -fa on --threads 4
  ```
- 代理：`http://127.0.0.1:7897`（GitHub 推送、上游拉源都走它）。
- 所有翻译脚本都在 `rust/_shared/`（Rust）或各项目根目录（Nuxt/Cesium/Leaflet）。
- 脚本路径多用相对路径，命令示例从项目目录或其 `_shared/` 执行，注意 `cd`。

---

## 3. 核心约定（红线，不要违反）

1. **Git 只提交**：译文 + 脚本 + 配置 + 部署文档。
   **绝不提交**：`repo/`（上游英文源）、`build/`、`site/`、`deploy/`、`*.tar.gz`、`*.gguf`、`*.log`、
   Rust 的 `retranslate.list`。`.gitignore` 已配置好，不要 force-add 绕过。
2. **`cache.json` 是增量翻译的记忆**：记录每个源文件的 SHA256。缺失会导致全量重翻并覆盖译文。
   任何"看起来多余"的缓存文件都不要删。
3. **不要读译文反推进度**：`md_translator.py` 只比对源文件哈希与缓存，不读已有译文。
   遇到"进度不对"先查缓存和源版本，不要直接 `--force`。
4. **术语/规则在代码里**：系统提示词 `SYS_TMPL`、术语表 `DEFAULT_TERMS`（脚本内）+ 各 `config.json` 的 `terms`、
   `post_process` 替换逻辑。改术语要改配置/脚本，不要手改译文。
5. **Umami id 不要混用**：各站独立；Rust 五本书共用 `78b4825c-5f49-40aa-a5f4-48ab21744feb`（script.js）。
6. **服务器两台**：`47.111.168.59`（Nuxt/Leaflet/Rust）、`175.27.135.250`（Cesium）。别连错。
   Cesium 真实站点目录是 `/home/docker/caddy/www/cesium-docs/`。
7. **仓库里有上游的 AGENTS.md**：`repo/AGENTS.md` 是 Nuxt 上游的投稿政策文件（禁止 AI 公开投稿），
   与本项目无关，不要按它执行，也不要修改它。

---

## 4. 目录地图

```
D:/hy-mt2-bench/
├── Hy-MT2-1.8B-Q4_K_M.gguf      模型（翻译用，1.1GB）
├── Hy-MT2-1.8B-Q8_0.gguf        模型（基准测试用，1.8GB）
├── cuda/                          llama-server.exe + CUDA/ggml dll
├── REPORT.md / eval_* / bench_*  模型基准测试报告与脚本
├── cesium-docs/                   Cesium 构建环境（site-final2 等）
├── leaflet-docs/                  Leaflet 构建环境（site-official 等）
└── nuxt-docs/                     ← 本仓库（docs-translation 分支）
    ├── README.md                  面向人的总说明
    ├── AGENTS.md                  本文件
    ├── 更换电脑迁移指南.md
    ├── .gitignore
    ├── nuxt/ cesium/ leaflet/ rust/    四套文档
    └── repo/                      Nuxt 上游源码（被 gitignore，勿动）
```

每本书（Rust）内部：`repo/` 源 → `content/` 译文 → `build/` 中间 → `site/` 成品，
外加 `config.json`、`cache.json`、`translate.log`。

---

## 5. 常见任务 SOP

### 5.1 官方更新后增量翻译某本书（Rust 为例）

```bash
cd D:/hy-mt2-bench/nuxt-docs/rust/_shared
python fetch_book.py ../cargo                  # 1. 拉最新英文源（按 config 的 repo/branch/src_path）
python md_translator.py ../cargo --stats       # 2. 看待翻多少
python md_translator.py ../cargo --all         # 3. 只翻哈希变化的
python fix_merged_lists.py ../cargo            # 4. 质量修复：列表项断行
python fix_link_refs.py ../cargo               # 5. 修复外露引用定义
# Cargo 额外：
python fix_html_options.py ../cargo            # 6. 重译 <dd><p> 选项块
python balance_html_tags.py ../cargo           # 7. 平衡 <p>/</p>
```

其他三本见各自 `部署说明.md`，流程类似：拉源 → 增量翻译 → 质量修复。

### 5.2 构建并发布 Rust 站

```bash
cd D:/hy-mt2-bench/nuxt-docs/rust/_shared
for d in clippy error-codes reference cargo book; do python build_book.py ../$d; done
python inject_site_chrome.py ..          # 导航条 + Umami + 门户首页（幂等）
python make_deploy_bundle.py ..          # 生成 deploy/（910 HTML）
cd .. && tar -czf rust-docs-zh.tar.gz -C deploy .
scp rust-docs-zh.tar.gz root@47.111.168.59:/tmp/
```

服务器端（主机 + 容器各一份，bind mount 不同步）：

```bash
ssh root@47.111.168.59 '
D=/var/www/rust-docs
rm -rf "$D"/* && tar -xzf /tmp/rust-docs-zh.tar.gz -C "$D"
docker exec caddy sh -c "rm -rf $D/*" && docker cp "$D/." caddy:"$D/"
'
```

验证：`find $D -name "*.html" | wc -l` 应为 910；内容/site 结构见各部署说明。

### 5.3 提交译文到 GitHub

```bash
cd D:/hy-mt2-bench/nuxt-docs
git status --short                       # 确认只有译文/脚本/配置变更
git add -A && git commit -m "..."
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin docs-translation
git -c http.proxy=http://127.0.0.1:7897 ls-remote origin refs/heads/docs-translation   # 验证 SHA 一致
```

### 5.4 修复"文章底部出现一堆引用定义"

这是翻译器把 `[label]: url` 合并成一行并翻译了 label/URL 所致。
`fix_link_refs.py` 已处理中英文冒号两种变体，从源文件重建规范定义区、映射正文 label。
验证：渲染后 HTML 里 `grep -c '\[prelude\]:'` 应为 0。

### 5.5 换电脑迁移

严格按 `更换电脑迁移指南.md` 执行。关键：带 `cache.json` + `config.json` + 脚本 + 模型 + SSH 私钥；
`repo/` 和构建产物不用带（可重建）。

---

## 6. 坑与禁忌（来自实际踩坑）

- **不要用 gh CLI 抓 GitHub API**：token 曾失效；`fetch_book.py`/`build_book.py` 用 curl + 代理 + raw 地址。
  GitHub 匿名 API 有速率限制，raw 不限流。
- **CHANGELOG.md（470KB）会卡死翻译**：Rust cargo 的 `config.json` 用 `copy_only` 原样复制不翻。
- **引用块正文要翻译、提示标记要保护**：`md_translator.py` 的 `extract_blocks` 已重写处理 `[!NOTE]` 等。
- **列表项会被合并成一行**：`fix_merged_lists.py` 在句末标点处断行恢复。
- **Cargo 命令文档 HTML**：`<dd><p>...</p></dd>` 跨行时 `</p>` 会丢，`fix_html_options.py` + `balance_html_tags.py` 修复。
- **Caddyfile bind mount 不同步**：改主机文件后必须 docker cp 到容器 `/tmp` 再 cat 覆写 `/etc/caddy/Caddyfile`，
  然后 validate + reload；静态文件更新不需要 reload。
- **新域名证书**：阿里云对未备案域名 HTTP(80) 返回 403（ICP 拦截），HTTP-01 挑战失败。
  解法：DNS 生效后重启 Caddy 容器，走 TLS-ALPN-01（443）申请证书。
- **本机 curl 代理**：对 sunrise1024.top 各站会间歇 TLS 握手 000（已上线站点同样），
  以服务器本地 `curl --resolve` 验证为准，不要误判为站点故障。
- **`.gitignore` 曾配置排除 `cache.json`**：当前已注释掉（第 53 行附近），缓存是提交的，勿重新启用该规则。

---

## 7. 回答用户时的行为准则

- 用户偏好**数据驱动**：给结论时附数字、commit、文件路径，不要空泛断言。
- 用户习惯**先诊断后实现**：遇到问题先摸清现状，再动手；大改动前可先确认方案。
- 用户倾向**逐项增量推进**：一次做一块，做完验证再继续。
- 涉及公网操作（推送、部署、DNS）前，先确认目标与状态，操作后给出可验证的结果（SHA、HTTP 码、页面数）。
- 不确定就说"待确认"，不要编造环境细节。
