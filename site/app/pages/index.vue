<script setup lang="ts">
const features = [
  { icon: 'i-lucide-rocket', title: '零配置', desc: '用 Vue 或 TypeScript 立即开始编码，Nuxt 为你处理好所有设置。' },
  { icon: 'i-lucide-layers', title: '渲染模式', desc: '服务端渲染、客户端渲染、静态站点生成，由你决定，精确到页面级别。' },
  { icon: 'i-lucide-route', title: '路由与布局', desc: '使用基于文件的路由系统构建复杂的 URL 视图，同时复用组件以提升性能。' },
  { icon: 'i-lucide-database', title: '数据获取', desc: '让你的 Vue 组件异步等待数据。Nuxt 提供强大的组合式函数实现通用数据获取。' },
  { icon: 'i-lucide-shield-alert', title: '错误处理', desc: '通过内置处理器和自定义错误页面捕获应用中的错误。' },
  { icon: 'i-lucide-shuffle', title: '过渡动画', desc: '在布局、页面和组件之间实现流畅的过渡效果。' },
  { icon: 'i-lucide-image', title: '资源与样式', desc: '内置支持图片、字体和脚本的自动优化。' },
  { icon: 'i-lucide-search', title: 'SEO 与元标签', desc: '创建可被搜索引擎完整索引的生产级应用。' },
  { icon: 'i-lucide-blocks', title: '模块化', desc: '通过 200+ 模块扩展 Nuxt 功能，更快交付应用。' },
  { icon: 'i-lucide-lock-keyhole', title: '中间件', desc: '在渲染页面前保护路由或添加自定义逻辑（本地化、A/B 测试）。' },
  { icon: 'i-lucide-file-code-2', title: 'TypeScript 类型安全', desc: '借助自动生成的类型和 tsconfig.json 编写类型安全的代码。' },
  { icon: 'i-lucide-book-open', title: '深入探索 Nuxt', desc: '立即开始阅读文档，全面了解 Nuxt 的能力。' },
]

const tools = [
  { name: 'Vue.js', icon: 'i-simple-icons-vuedotjs', desc: '前端基于 Vue.js，利用其响应式、组件化架构构建强大且可扩展的应用。', link: 'https://vuejs.org' },
  { name: 'Vite', icon: 'i-simple-icons-vite', desc: 'Nuxt 利用 Vite 的前端构建能力，通过即时 HMR 提供最佳开发体验。', link: 'https://vite.dev' },
  { name: 'Nitro', icon: 'i-lucide-server', desc: 'Nuxt 使用 Nitro 作为服务器引擎，构建可部署到任意平台的多功能全栈应用。', link: 'https://nitro.build' },
]

const sampleCode = `<script setup lang="ts">
const version = 4
<\/script>

<template>
  <h1>Hello Nuxt {{ version }}!</h1>
<\/template>`
</script>

<template>
  <div class="overflow-hidden">
    <!-- Hero -->
    <section class="relative px-6 pt-20 pb-16 sm:pt-28">
      <div class="max-w-4xl mx-auto text-center">
        <div class="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm text-green-600 dark:text-green-400 mb-8">
          <span class="i-lucide-sparkles text-base" />
          Nuxt v4.6.4 中文文档
        </div>
        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          直观的<span class="text-green-500">全栈 Vue 框架</span>
        </h1>
        <p class="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
          用 Vue 构建快速、可用于生产环境的 Web 应用。文件路由、自动导入、服务端渲染，全部开箱即用。
        </p>
        <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
          <NuxtLink to="/getting-started/installation" class="inline-flex items-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 transition-colors">
            开始使用
            <span class="i-lucide-arrow-right" />
          </NuxtLink>
          <NuxtLink to="/getting-started/introduction" class="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 font-semibold px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            100 秒了解 Nuxt
          </NuxtLink>
        </div>
        <div class="mt-12 max-w-xl mx-auto">
          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-950 shadow-2xl overflow-hidden text-left">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <span class="w-3 h-3 rounded-full bg-red-500" />
              <span class="w-3 h-3 rounded-full bg-yellow-500" />
              <span class="w-3 h-3 rounded-full bg-green-500" />
              <span class="ml-2 text-xs text-gray-500">终端</span>
            </div>
            <div class="px-5 py-4 font-mono text-sm text-gray-200">
              <span class="text-green-400">$</span> npm create nuxt@latest my-app
            </div>
          </div>
          <p class="mt-5 text-sm text-gray-500 dark:text-gray-500">
            本文档基于 <span class="font-semibold text-green-600 dark:text-green-400">Nuxt v4.6.4</span> 官方稳定版翻译 · 本地 Hy-MT2-1.8B 模型生成
          </p>
        </div>
      </div>
    </section>

    <!-- Code preview -->
    <section class="px-6 py-10">
      <div class="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
            <span class="i-simple-icons-vuedotjs text-lg" />
            app/app.vue
          </div>
          <pre class="p-5 text-sm overflow-x-auto text-gray-800 dark:text-gray-200"><code>{{ sampleCode }}</code></pre>
        </div>
        <div>
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white">简单起步，强大内核</h2>
          <p class="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            只需编写 <code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-green-600 dark:text-green-400">.vue</code> 文件即可开始——开发时享受热模块替换，生产时默认获得服务端渲染带来的高性能。
          </p>
          <NuxtLink to="/getting-started/introduction" class="mt-6 inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold hover:underline">
            了解更多 <span class="i-lucide-arrow-right" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="px-6 py-20 bg-gray-50 dark:bg-gray-900/50">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-14">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">你需要的一切，应有尽有</h2>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">Nuxt 处理架构，让你专注于构建。</p>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="f in features" :key="f.title" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 hover:shadow-lg hover:border-green-500/40 transition-all">
            <div class="w-11 h-11 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center text-2xl mb-4">
              <span :class="f.icon" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ f.title }}</h3>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Built on tools -->
    <section class="px-6 py-20">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-14">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">基于成熟的工具</h2>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">前端用 Vue，服务端用 Nitro，打包器随你选择。</p>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
          <a v-for="t in tools" :key="t.name" :href="t.link" target="_blank" class="rounded-xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg hover:border-green-500/40 transition-all">
            <div class="text-3xl mb-4"><span :class="t.icon" /></div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t.name }}</h3>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{{ t.desc }}</p>
          </a>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="px-6 py-16 bg-green-500">
      <div class="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-white">
        <div>
          <div class="text-4xl font-bold">13.4M</div>
          <div class="mt-2 opacity-90">每月下载量</div>
        </div>
        <div>
          <div class="text-4xl font-bold">61.1K</div>
          <div class="mt-2 opacity-90">GitHub Stars</div>
        </div>
        <div>
          <div class="text-4xl font-bold">200+</div>
          <div class="mt-2 opacity-90">官方与社区模块</div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="px-6 py-24 text-center">
      <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">立即开始构建</h2>
      <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">阅读中文文档，几分钟内搭建你的第一个 Nuxt 应用。</p>
      <NuxtLink to="/getting-started/installation" class="mt-8 inline-flex items-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-3.5 transition-colors">
        开始使用 <span class="i-lucide-arrow-right" />
      </NuxtLink>
    </section>
  </div>
</template>
