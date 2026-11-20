# Hy-MT2 文档翻译系统

使用本地 **Hy-MT2-1.8B** 模型，把开源框架官方文档翻译成中文，并搭建与官网同款的文档站。

当前已翻译：**Nuxt v4.6.4 全站 253 篇** → https://nuxt.sunrise1024.top/

---

## 核心特性

1. **增量翻译**：对每个源文件算 SHA256 存缓存，官方更新后 `git pull`，只重新翻译内容变化的文档，未变的直接跳过（实测：切版本时 253 篇里只翻了 78 篇，175 篇跳过）。
2. **结构保留**：代码块、行内代码、链接 URL、文件路径、MDC 组件标记全部原样保留，只翻译自然语言。
3. **术语统一**：术语表强制统一（composable→组合式函数、tree-shaking→摇树优化…）。
4. **断点续传**：每翻完一篇立即存缓存，中途失败可重跑。
5. **官网同款站点**：Docus 主题（nuxt.com 官方主题），顶部章节 tab、侧边栏、代码高亮、暗色模式。
6. **多目标部署**：同一份译文产出 WorkBuddy 托管版 + 自有服务器版，各自的 Umami 统计 id 独立。

---

## 目录结构

```
.
├── config.json          # 本项目配置（源仓库/版本/术语表/部署/统计 id）
├── incremental.py       # 增量翻译引擎
├── translate_nav.py     # 导航配置 .navigation.yml 翻译
├── update.sh            # 一键更新：pull → 增量翻译 → 生成 → 打包双版本
├── cache.json           # 翻译缓存（哈希→译文映射，团队可共享以跳过重复翻译）
├── content/             # ⚠️ 见下方说明（实际在 site/content/）
├── site/                # Docus 站点（配置 + 首页组件 + content/ 译文）
│   ├── nuxt.config.ts
│   ├── app.config.ts
│   ├── app/pages/index.vue   # 仿官网营销首页
│   ├── content/              # 253 篇中文译文（核心资产）
│   ├── scripts/              # 图标内联等后处理
│   └── package.json
├── deploy/              # WorkBuddy 托管版部署配置
└── deploy-server/       # 自有服务器版（见 部署说明.md）
```

> 译文实际在 `site/content/`（Docus 要求）。

---

## 环境准备

1. **本地翻译模型**：用 llama.cpp 启动 Hy-MT2-1.8B-Q4_K_M.gguf（Q4_K_M，1.1GB）：
   ```bash
   llama-server -m Hy-MT2-1.8B-Q4_K_M.gguf --port 8999 -ngl 99 -fa on
   ```
   模型文件不入库（体积大），需自行下载。
2. **Node 22 + pnpm**：站点依赖 `cd site && pnpm install`。
3. **Python 3**：跑翻译脚本（仅用标准库）。

---

## 日常使用

```bash
# 查看翻译进度
python incremental.py --stats

# 翻译某一章 / 某篇 / 全部
python incremental.py --chapter 1.getting-started
python incremental.py --file 1.getting-started/01.introduction.md
python incremental.py --all

# 官方更新后，清理已删除的旧文档（移到 _pruned/ 备份）
python incremental.py --prune

# 一键闭环：拉官方更新 → 增量翻译 → 生成 → 打包双版本
bash update.sh
```

---

## 如何新增一套文档（重要）

本项目按**目录区分**多个文档项目——每套文档一个独立目录，而不是用 git 分支。
原因：多套文档需要同时存在、各自独立更新，且各自的源仓库/术语/部署配置都不同。

步骤：

1. 复制一套作为模板：
   ```bash
   cp -r . ../vue-docs        # 或在本仓库内建同级目录
   ```
2. 修改 `config.json`：
   - `name` / `displayName` / `version`
   - `source.url` / `source.ref` / `source.siteOrigin`
   - `translation.terms`（换成该框架的术语）
   - `deploy.domain` / Umami id
3. 拉取新文档源：`git clone --depth 1 <源仓库> repo`
4. 先翻一章看效果：`python incremental.py --chapter <章节>`
5. 满意后全量：`python incremental.py --all`
6. 调整 `site/app/pages/index.vue` 的首页文案和 `nuxt.config.ts` 的站点名/版本。

翻译内核 `incremental.py` 是通用的；站点渲染层（Docus 配置、首页、图标内联）可按新文档风格调整。

---

## 部署

详见 `deploy/部署说明.md`。简要：

- **WorkBuddy 托管**：在 `deploy/` 目录跑发布工具（目录固定，链接不变）
- **自有服务器**：用 `deploy-server/nuxt-docs-dist.tar.gz`，Caddy 静态托管 + 自动 HTTPS

两个目标用**不同的 Umami 脚本和 website-id**，见 `config.json` 的 `deploy.umami`。

---

## 翻译质量说明

- 译文由 8B 本地模型生成，措辞与官网（若有官方中文）不一致属正常，但语义与结构一一对应。
- Nuxt 官方站没有中文文档，用户看到的中文是浏览器自动翻译；本项目提供的是本地可控、可离线保存的中文版。
- 术语表持续维护中，发现不一致可改 `config.json` 的 `terms` 后用 `--force` 重翻相关文档。

---

## 仓库分支与扩展约定

本仓库 `Sunrisies/rust-translation` 有两个分支，用途完全隔离：

| 分支 | 内容 | 状态 |
|---|---|---|
| `main` | Rust 翻译工具（sunrise-translation） | 原有项目，未改动 |
| `docs-translation` | 本文档翻译系统（本文件所在分支） | 当前使用 |

**分支用于隔离不同技术栈/用途；目录用于区分同类多套文档。**

### 后续新增第二套文档时

当前分支是"单套文档"结构（根目录即 Nuxt 这一套）。当要翻译第二套文档（如 Vue）时，推荐重构成多文档目录结构：

```
docs-translation/
├── _shared/translator.py    # 抽出通用翻译内核
├── nuxt/                    # 现有内容整体移入
│   ├── config.json
│   ├── content/
│   └── site/ + deploy/
└── vue/                     # 新增：cp -r nuxt/ vue/ 后改配置
```

为什么不现在就重构：当前只有一套文档，重构会改动所有脚本路径，收益尚未兑现。等加第二套时一次到位。

### 仓库地址与提交

- 仓库：https://github.com/Sunrisies/rust-translation
- 文档系统分支：`docs-translation`（孤儿分支，不含 main 的 Rust 文件）
- 提交：`git checkout docs-translation` 后正常 commit/push 即可，不会影响 main
