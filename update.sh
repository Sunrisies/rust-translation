#!/usr/bin/env bash
# Nuxt 中文文档一键更新流程
# 用法: bash update.sh [--all]
#   --all  翻译全站 263 篇（默认只翻 getting-started 章节）
#
# 注意：本环境拦截删除操作（rm/Remove-Item 都会被 safe-delete 挡），
# 所以重新生成前必须先停掉占用 .output 的静态服务器，再把 .output 改名。

set -e
ROOT="D:/hy-mt2-bench/nuxt-docs"
SITE="$ROOT/site"

echo "===== 1/5 拉取官方最新文档 ====="
cd "$ROOT/repo"
git pull --depth 1 origin main 2>&1 | tail -5 || echo "（pull 失败，继续用本地现有内容）"

echo ""
echo "===== 2/5 增量翻译（只翻新增/变化的 .md）====="
cd "$ROOT"
if [ "$1" = "--all" ]; then
  python incremental.py --all
  python translate_nav.py   # 官方可能改 .navigation.yml，重翻导航标题
else
  python incremental.py --chapter 1.getting-started
fi
# 官方新增章节时，把新增的 .navigation.yml 也复制过来
python -c "
from pathlib import Path
import shutil
src=Path('$ROOT/repo/docs'); dst=Path('$ROOT/site/content')
for f in src.rglob('.navigation.yml'):
    t=dst/f.relative_to(src)
    if not t.exists(): t.parent.mkdir(parents=True,exist_ok=True); shutil.copy(f,t)
print('导航配置已同步')
"
python translate_nav.py

echo ""
echo "===== 3/5 停止预览服务器（释放 .output）====="
PID=$(netstat -ano 2>/dev/null | grep ':3200 ' | grep LISTENING | awk '{print $5}' | head -1)
if [ -n "$PID" ]; then
  taskkill //PID "$PID" //F >/dev/null 2>&1 || true
  echo "已停止旧服务 (PID $PID)"
else
  echo "无运行中的服务"
fi
sleep 2

echo ""
echo "===== 4/5 重新生成静态站 ====="
cd "$SITE"
# 环境拦截删除，用改名代替；保留最近 2 份旧产物便于回滚
[ -d .output_old2 ] && mv .output_old2 .output_old3 2>/dev/null || true
[ -d .output_old ] && mv .output_old .output_old2 2>/dev/null || true
[ -d .output ] && mv .output .output_old 2>/dev/null || true
node node_modules/nuxt/bin/nuxt.mjs generate --cwd "$SITE" 2>&1 | tail -6

# 内联图标（静态生成时 CSS 图标不会打包，必须后处理成内联 SVG）
echo "内联图标 SVG ..."
cd "$SITE"
node scripts/inline-icons.mjs 2>&1 | tail -1

# 同步到 WorkBuddy 发布目录（script.js + WorkBuddy 专用 id）
echo "同步静态文件到 deploy/public (WorkBuddy 版) ..."
cd "$ROOT"
if [ -d "$ROOT/deploy/public" ]; then mv "$ROOT/deploy/public" "$ROOT/deploy/public_old_$(date +%s)" 2>/dev/null || true; fi
cp -r "$SITE/.output/public" "$ROOT/deploy/public"
echo "deploy/public 已同步"

# 生成自有服务器版（recorder.js + 服务器专用 id）
echo "生成自有服务器版 deploy-server/public ..."
node "$ROOT/scripts/make-server-dist.mjs" 2>&1 | tail -1

echo "重新打包 ..."
cd "$ROOT/deploy"
tar -czf nuxt-docs-dist.tar.gz -C public .
echo "WorkBuddy 包: $(ls -lh nuxt-docs-dist.tar.gz | awk '{print $5}')"
cd "$ROOT/deploy-server"
tar -czf nuxt-docs-dist.tar.gz -C public .
echo "服务器包: $(ls -lh nuxt-docs-dist.tar.gz | awk '{print $5}')"

echo ""
echo "===== 5/5 重启预览服务器 ====="
cd "$SITE"
nohup node serve.mjs > "$ROOT/serve.log" 2>&1 &
sleep 3
curl -s -o /dev/null -w "预览站状态: HTTP %{http_code}\n" http://127.0.0.1:3200/

echo ""
echo "===== 完成 ====="
cd "$ROOT"
python incremental.py --stats
