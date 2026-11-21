# Hy-MT2 文档翻译系统

用本地 **Hy-MT2-1.8B** 模型，把开源框架官方文档翻译成中文，并搭成与官网同款的文档站。官方更新时只翻变化的部分。

## 已完成的文档

| 文档 | 版本 | 规模 | 线上地址 |
|---|---|---|---|
| **Nuxt** | v4.6.4 | 253 篇 markdown | https://nuxt.sunrise1024.top/ |
| **Cesium** | v1.147.0 | 985 个 JSDoc 源 / 357 页 API | https://cesium.sunrise1024.top/ |
| **Leaflet** | v1.9.4 稳定版 | 83 个 Leafdoc 源 + 65 篇教程 / 23 页 | https://leaflet.sunrise1024.top/ |

另有 WorkBuddy 托管镜像：https://nuxt-docs-zh.app.workbuddy.host/?sharecode=AYJMZQT7S7

---

## 核心特性

1. **增量翻译**：SHA256 内容哈希缓存，官方更新后只翻变化的文档（Nuxt 实测：253 篇里 78 篇重翻、175 篇跳过；Cesium 同理）。
2. **结构保留**：markdown / JSDoc 的代码、链接、类型、参数名、组件标记全部原样保留，只翻译自然语言。
3. **术语统一**：术语表强制一致（composable→组合式函数、widget→控件…）。
4. **断点续传**：每翻完一个文件立即写缓存，中断可重跑。
5. **官网同款站点**：Nuxt 用 Docus 主题（顶部章节 tab + 侧边栏）；Cesium 用 JSDoc（API 参考标准布局）；Leaflet 复用官网 HTML 外壳（含可交互地图）。
6. **多目标部署**：WorkBuddy 托管 + 自有服务器（Caddy / nginx），各自独立的 Umami 统计 id。

---

## 仓库结构（docs-translation 分支）

```
.
├── README.md                # 本文件（总说明）
├── .gitignore               # 全局排除规则
│
├── nuxt/                    # Nuxt 项目（第一套文档）
│   ├── 部署说明.md           # Nuxt 完整构建+部署手册
│   ├── config.json          # Nuxt 项目配置
│   ├── cache.json           # 增量翻译缓存
│   ├── incremental.py       # markdown 增量翻译引擎
│   ├── translate.py         # 早期翻译脚本（参考）
│   ├── translate_nav.py     # 导航配置翻译
│   ├── update.sh            # 一键更新流程
│   ├── site/                # Docus 站点（site/content/ 是 253 篇译文）
│   ├── deploy/              # WorkBuddy 托管版部署配置
│   └── scripts/             # 后处理脚本（图标内联等）
│
├── cesium/                  # Cesium 项目（第二套文档）
│   ├── 部署说明.md           # Cesium 完整构建+部署手册（先看这个）
│   ├── config.json          # Cesium 配置（版本/服务器/统计id）
│   ├── translated/          # 985 个改了 JSDoc 注释的 js（译文）
│   └── scripts/             # 拉取/翻译/修复/生成/统计 6 个脚本
│
└── leaflet/                 # Leaflet 项目（第三套文档）
    ├── 部署说明.md           # Leaflet 完整构建+部署手册（先看这个）
    ├── translated/          # 83 个改了 Leafdoc 注释的 js + 65 篇教程 md
    ├── nav-translated/      # 导航页译文（首页/教程索引/安装）
    ├── scripts/             # 拉取/翻译/生成脚本
    └── *.py                 # 翻译器（leafdoc/tutorial/html/nav）
```

> 三套文档统一放在 `nuxt/`、`cesium/`、`leaflet/` 三个同级目录，只上传译文、脚本、配置、文档；英文源码（repo/）、node_modules、构建产物（.output/）都不传。Nuxt 的英文源仓库在 `D:/hy-mt2-bench/nuxt-docs/repo/`（共享源材料，仍在仓库根，被 .gitignore 排除）。

---

## 环境准备

1. **翻译模型**：llama.cpp 启动 Hy-MT2-1.8B-Q4_K_M.gguf（Q4_K_M，1.1GB）：
   ```bash
   llama-server -m Hy-MT2-1.8B-Q4_K_M.gguf --port 8999 -ngl 99 -fa on
   ```
   模型文件不入库，需自行下载。
2. **Node 22 + pnpm**（Nuxt 站点）/ **jsdoc**（Cesium 站点）/ **leafdoc**（Leaflet 站点，`npm install leafdoc@2.4.0`）。
3. **Python 3**：翻译脚本只用标准库。

---

## 日常使用

**Nuxt：** 详见 `nuxt/deploy/部署说明.md`，简要：
```bash
cd D:/hy-mt2-bench/nuxt-docs/nuxt
python incremental.py --stats             # 进度
python incremental.py --all               # 增量翻译全部
bash update.sh                            # 一键：pull → 翻译 → 生成 → 打包
```

**Cesium：** 详见 `cesium/部署说明.md`，简要：
```bash
cd D:/hy-mt2-bench/cesium-docs
python fetch_sources.py                   # 拉最新版源文件
python jsdoc_translator.py --all          # 增量翻译
python fix_links.py && python fix_types.py  # 质量修复
# 生成 + 后处理 + 部署见部署说明.md 第 4-6 步
```

**Leaflet：** 详见 `leaflet/部署说明.md`，简要：
```bash
cd D:/hy-mt2-bench/leaflet-docs
python fetch_sources.py                   # 拉 v1.9.4 源文件
python leafdoc_translator.py --all        # API 注释增量翻译
python tutorial_translator.py --all       # 教程 markdown 翻译
python build_site_official.py             # 组站（23 HTML，官网外壳）
# 生成 API 页 + 部署见部署说明.md 第 3、7 步
```

---

## 后续新增第三套文档

沿用"**分支隔离技术栈、目录区分多套文档**"的约定：

- 本分支 `docs-translation` 专放文档翻译系统（与 main 分支的 Rust 项目隔离）
- 每新增一套文档 = 在分支内新建同级目录（如 `vue/`），复制模板改配置
- 通用翻译内核（`incremental.py` / `jsdoc_translator.py`）按需复用，站点渲染层按新框架调整

---

## GitHub

- 仓库：https://github.com/Sunrisies/rust-translation
- 文档系统分支：`docs-translation`（孤儿分支，不含 main 的 Rust 项目）
- 上传策略：**只传译文与脚本，不传英文源码、模型、构建产物**
- 提交后正常 `git add/commit/push` 即可，不影响 main 分支

---

## 翻译质量说明

- 译文由 8B 本地模型生成，措辞与官方中文（若有）不一致属正常，语义与结构一一对应。
- Nuxt 官方无中文文档；Cesium 官方有部分语言版本但本项目提供本地可控的中文 API 文档。
- 术语表持续维护中，发现不一致改配置后 `--force` 重翻相关文档。
