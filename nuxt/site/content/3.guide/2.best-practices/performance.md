---
navigation.title: 'Nuxt Performance'
title: Nuxt 性能
description: 提升 Nuxt 应用性能的最佳实践。
---

Nuxt 提供了内置功能，旨在提高应用的性能并有助于改善 [核心 Web 指标](https://web.dev/articles/vitals)。此外，还有多个 Nuxt 核心模块可在特定方面帮助提升性能。本指南概述了优化 Nuxt 应用性能的最佳实践。

## 内置功能

Nuxt 提供了多种内置功能，有助于优化网站性能。了解这些功能的工作原理对于实现极速性能至关重要。

### 链接

[`<NuxtLink>`](/docs/api/components/nuxt-link) 是 Vue Router 的 `<RouterLink>` 组件和 HTML 的 `<a>` 标签的替代方案。它能够智能判断链接是内部还是外部，并根据可用优化技术（预加载、默认属性等）进行相应渲染。

```html
<template>
  <NuxtLink to="/about">About page</NuxtLink>
</template>

<!-- Which will render to with Vue Router & Smart Prefetching -->
<a href="/about">About page</a>
```

Nuxt 自动包含智能预加载功能。这意味着它会在默认情况下检测链接何时可见，无论是在视口中还是滚动时，并预先加载这些页面的 JavaScript，以便用户点击链接时页面已准备好。

您也可以选择在交互时进行预加载：

```ts
export default defineNuxtConfig({
  experimental: {
    defaults: {
      nuxtLink: {
        prefetchOn: {
          interaction: true,
          visibility: false,
        },
      },
    },
  },
})
```

:read-more{title="NuxtLink" to="/docs/api/components/nuxt-link"}

### 资源提示

为了加速客户端导航，Nuxt 为请求解析的 JavaScript 和 CSS 块添加资源提示。`<link rel="preload">` (或 `modulepreload`) 标记页面本身所需的块，而 `<link rel="prefetch">` 标记入口点和渲染组件延迟导入的块，这样当用户稍后导航到这些块时，它们就能快速加载。

在大型应用中，预加载的集合可能会超过页面实际需要的量。公共页面和已登录应用通常共享一个入口块，因此预渲染的公共页面可以预加载仅被已登录应用使用的块。预加载提示的下载优先级较低，但在大量情况下，它们仍可能与阻塞样式表竞争，并在连接较慢时延迟首次绘制。

要停止某个块被预加载，可以在 [`build:manifest`](/docs/api/advanced/hooks#nuxt-hooks-build-time) 钩子中将其清单条目中的 `prefetch` 设置为 `false`：

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  hooks: {
    'build:manifest': (manifest) => {
      for (const chunk of Object.values(manifest)) {
        if (chunk.src?.startsWith('pages/app/')) {
          chunk.prefetch = false
        }
      }
    },
  },
})
```

这会移除所有源位于 `pages/app/` 下的块的 `rel="prefetch"` 提示，同时保留包中的块以及 `preload` 和 `modulepreload` 提示。调整 `startsWith` 前缀为公共页面不应预加载的目录。

您还可以使用 [`preloadComponents`](/docs/api/utils/preload-components)、 [`preloadRouteComponents`](/docs/api/utils/preload-route-components) 和 [`prefetchComponents`](/docs/api/utils/prefetch-components) 从自身代码中预加载特定的组件或路由。

### 混合渲染

在更复杂的应用中，我们可能需要完全控制应用程序的渲染方式，以支持某些页面在构建时生成，而另一些页面则应在客户端端渲染的情况。

混合渲染允许使用 Route Rules 对每个路由实施不同的缓存规则，并决定服务器如何响应给定 URL 的新请求：

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': {
      prerender: true,
    },
    '/products/**': {
      swr: 3600,
    },
    '/blog': {
      isr: 3600,
    },
    '/admin/**': {
      ssr: false,
    },
  },
})
```

Nuxt 服务器将自动注册相应的中间件，并使用 Nitro 缓存层对路由进行缓存处理包装。

:read-more{title="混合渲染" to="/docs/guide/concepts/rendering#hybrid-rendering"}

### 组件懒加载

要动态导入组件（也称为组件懒加载），只需在组件名称前添加 Lazy 前缀即可。如果组件并非始终需要，这样做非常有用。

```html
<script setup lang="ts">
const show = ref(false)
</script>

<template>
  <div>
    <h1>Mountains</h1>
    <LazyMountainsList v-if="show" />
    <button v-if="!show" @click="show = true">Show List</button>
  </div>
</template>
```

通过使用 Lazy 前缀，您可以延迟加载组件代码，直到合适的时刻，这有助于优化 JavaScript 包的大小。

:read-more{title="组件懒加载" to="/docs/directory-structure/app/components#dynamic-imports"}

### 懒 hydration

在初始加载时，并非总是有必要让网站的所有组件都进行 hydration（或变得可交互）。使用懒 hydration，您可以控制组件何时加载代码，从而改善应用程序的互动时间指标。Nuxt 允许通过懒 hydration 控制组件何时变得可交互（自 Nuxt v3.16 起支持）。

```html
<template>
  <div>
    <LazyMyComponent hydrate-on-visible />
  </div>
</template>
```

为了优化应用程序，您可能希望延迟某些组件的 hydration，直到它们可见时，或直到浏览器完成更重要的任务。

:read-more{title="懒加载 hydration" to="/docs/directory-structure/app/components#delayed-or-lazy-hydration"}

对于需要很少或没有客户端交互的内容和营销网站，您可以进一步结合预渲染、`noScripts` 路由规则、[服务器组件](/docs/guide/concepts/server-components) 和懒 hydration，以生成几乎不含 JavaScript 的页面。

:read-more{title="静态站点" to="/docs/guide/recipes/mostly-static-sites"}

### 数据获取

为了避免重复获取相同数据（一次在服务器上，一次在客户端上），Nuxt 提供了 [`useFetch`](/docs/api/组合式函数/use-fetch) 和 [`useAsyncData`](/docs/api/组合式函数/use-async-data)。它们确保如果服务器发起 API 调用，数据将作为负载传送到客户端，而不是再次获取。

:read-more{title="数据获取" to="/docs/getting-started/data-fetching"}

## 核心 Nuxt 模块

除了 Nuxt 内置功能之外，Nuxt 团队还维护了一些核心模块，这些模块有助于进一步提升性能。这些模块可以处理图像、自定义字体或第三方脚本等资源。

### 图像

未优化的图像会对网站性能产生显著的负面影响，尤其是 [最大内容绘制 (LCP)](https://web.dev/articles/lcp) 评分方面。

在 Nuxt 中，我们可以使用 [Nuxt Image](https://image.nuxt.com/) 模块，这是一个适用于 Nuxt 应用的即插即用的图像优化工具。它允许使用内置优化器或您喜欢的图像 CDN 对图像进行缩放和转换。

:video-accordion{title="LearnVue 视频：Nuxt Image" videoId="_UBff2eqGY0"}

[`<NuxtImg>`](/docs/api/components/nuxt-img) 是一个可直接替换原生 `<img>` 标签的组件，并具有以下增强功能：

* 使用内置提供器来优化本地和远程图像
* 将 `src` 转换为采用 WebP 或 Avif 等现代格式的优化后的 URL
* 根据 `width` 和 `height` 自动调整图像大小
* 在提供尺寸选项时生成响应式 `sizes` 值
* 支持原生 `lazy loading` 以及其他 `<img>` 属性

网站中的图像通常可以根据重要性进行分类：那些在初始加载时需要首先加载的图像（即 `Largest Contentful Paint`），以及那些可以稍后加载或在特定需求时加载的图像。为此，我们可以使用以下优化方法：

```html
<template>
  <!-- 🚨 Needs to be loaded ASAP -->
  <NuxtImg
    src="/hero-banner.jpg"
    format="webp"
    :preload="{ fetchPriority: 'high' }"
    loading="eager"
    width="200"
    height="100"
  />

  <!-- 🐌 Can be loaded later -->
  <NuxtImg
    src="/facebook-logo.jpg"
    format="webp"
    loading="lazy"
    fetchpriority="low"
    width="200"
    height="100"
  />
</template>
```

:read-more{title="Nuxt Image" to="https://image.nuxt.com/usage/nuxt-img"}

### 字体

[Nuxt Fonts](https://fonts.nuxt.com/) 会自动优化您的字体（包括自定义字体），并移除外部网络请求，从而提升隐私性和性能。

它包含对任何字体文件的自动自托管功能，这意味着您可以通过底层包 [fontaine](https://github.com/unjs/fontaine) 以减少布局偏移的方式最优地加载网页字体。

:video-accordion{title="Daniel Roe 演讲：Nuxt Fonts 原理" videoId="D3F683UViBY"}

Nuxt Fonts 处理所有您的 CSS，并在遇到 `font-family` 声明时自动执行以下操作：

1. **解析字体** – 在 public/ 目录中查找字体文件，然后检查 Google、Bunny 和 Fontshare 等网络提供器。
2. **生成 @font-face 规则** – 注入 CSS 规则以从正确的来源加载字体。
3. **代理和缓存字体** – 重写 URL 为 `/_fonts`，并下载和本地缓存字体。
4. **创建备用指标** – 调整本地系统字体以匹配网页字体，从而减少布局偏移（[CLS](https://web.dev/articles/cls)）。
5. **在构建中包含字体** – 将字体与项目捆绑在一起，对文件名进行哈希处理，并设置长寿命缓存头信息。

它支持多种设计成可插拔且可扩展的提供方，因此无论你的设置如何，你都可以使用现有的提供方或编写自己的提供方。

### Scripts

第三方资源如分析工具、视频嵌入、地图和社交媒体集成可以增强网站功能，但可能会显著降低用户体验，并对[交互到下一个绘制时刻 (INP)](https://web.dev/articles/inp)和最大内容绘制时刻 (LCP) 评分产生负面影响。

[Nuxt Scripts](https://scripts.nuxt.com/) 允许你加载性能更好、隐私保护更完善、安全性更高且开发体验更佳的第三方脚本。

:video-accordion{title="Alex Lichter 视频：Nuxt Scripts" videoId="sjMqUUvH9AE"}

Nuxt Scripts 在第三方脚本之上提供一层抽象层，提供 SSR 支持和类型安全功能，同时仍让你完全控制脚本的加载方式。

```ts
const { onLoaded, proxy } = useScriptGoogleAnalytics(
  {
    id: 'G-1234567',
    scriptOptions: {
      trigger: 'manual',
    },
  },
)
// queue events to be sent when ga loads
proxy.gtag('config', 'UA-123456789-1')
// or wait until ga is loaded
onLoaded((gtag) => {
  // script loaded
})
```

:read-more{title="Nuxt Scripts" to="https://scripts.nuxt.com/scripts"}

## 性能分析工具

为了提升性能，我们首先需要知道如何衡量性能，首先是在本地环境中进行开发阶段的性能测量，然后是对部署到生产环境的应用进行审计。

### Nuxi Analyze

`nuxt` 的[此](/docs/api/commands/analyze)命令允许你分析 Nuxt 应用的生产打包文件。它利用 `vite-bundle-visualizer`（类似于 `webpack-bundle-analyzer`）生成应用程序打包文件的可视化表示，从而更容易识别哪些组件占用了最多的空间。

在可视化图中看到大块区域时，通常意味着有优化的机会——可以通过将其拆分为更小的部分、实现延迟加载，或替换为更高效的替代方案，尤其是对于第三方库而言。

包含多个元素的较大块通常可以通过仅导入必要的组件而不是整个模块来减少，而大型独立块则更适合采用延迟加载方式，而不是包含在主打包文件中。

### Nuxt DevTools

[Nuxt DevTools](/modules/devtools) 为你提供关于 Nuxt 应用的洞察和透明度，以便识别性能问题并轻松管理应用配置。

![Nuxt DevTools example](https://user-images.githubusercontent.com/11247099/217670806-fb39aeff-3881-44e5-b9c8-6c757f5925fc.png)

它包含多种功能，可用于衡量 Nuxt 应用的性能：
1. **Timeline** – 记录渲染、更新和初始化组件所花费的时间，以识别性能瓶颈。
2. **Assets** – 显示未经处理的文件大小（例如图片）。
3. **Render Tree** – 展示 Vue 组件、脚本和样式之间的连接关系，从而优化动态加载。
4. **Inspect** – 列出 Vue 应用中所有文件及其大小和执行时间。

### Chrome DevTools

Chrome DevTools 包含两个有用的标签页用于测量性能：`Performance` 和 `Lighthouse`。

当您打开 [Performance](https://developer.chrome.com/docs/devtools/performance/overview) 面板时，它会立即显示您的本地 **Largest Contentful Paint (LCP)** 和 **Cumulative Layout Shift (CLS)** 得分（良好、需要改进或不良）。

如果您与页面进行交互，它还会捕获 **Interaction to Next Paint (INP)**，根据您的设备和网络状况为您提供完整的 Core Web Vitals 视图。

![Chrome DevTools Performance Panel](https://developer.chrome.com/static/docs/devtools/performance/image/cpu-throttling_856.png)

[Lighthouse](https://developer.chrome.com/docs/devtools/lighthouse) 会对性能、可访问性、SEO、渐进式 Web 应用和最佳实践进行审计。它会在页面上运行测试并生成报告。将失败的审计作为改进网站的指南。

![Lighthouse](https://developer.chrome.com/static/docs/lighthouse/images/lighthouse-overview_720.png)

每个审计都有参考文档，解释为什么该审计很重要以及如何修复它。

### PageSpeed Insights

[PageSpeed Insights (PSI)](https://developers.google.com/speed/docs/insights/v5/about) 报告页面在移动和桌面设备上的用户体验情况，并提供改进建议。

它提供实验室和现场数据关于页面的情况。实验室数据有助于调试问题，因为它是在受控环境中收集的；而现场数据则有助于捕捉真实的用户体验。

### Web Page Test

[WebPageTest](https://www.webpagetest.org/) 是一种网页性能工具，提供关于页面在不同条件下表现的深入诊断信息。

每个测试可以在全球不同的地点、使用真实的浏览器以及任意数量的可定制网络条件下进行。

## 常见问题

在构建更复杂的 Nuxt 应用时，您可能会遇到以下一些问题。理解这些问题并解决它们将帮助您提升网站的性能。

### 过度使用插件

**问题**：大量使用插件会导致性能问题，尤其是当这些插件需要昂贵的计算或初始化时间过长时。由于插件在 hydration 阶段运行，低效的设置可能会阻塞渲染过程并降低用户体验。

**解决方案**：检查你的插件，看看是否有一些可以以组合式函数或工具函数的形式实现。

### 未使用的代码/依赖项

**问题**：随着项目的开发，可能会出现一些未使用的代码或依赖项。这些额外的功能可能不会被使用或需要，同时会增加项目的包大小。

**解决方案**：检查你的 `package.json` 中的未使用依赖项，并分析代码中未使用的 utils/组合式函数/功能。

### 未使用 Vue 性能优化技巧

**问题**：[Vue 文档](https://vuejs.org/guide/best-practices/performance)列出了我们可以在 Nuxt 项目中使用的几种性能优化方法，但由于这些内容属于 Vue 文档的一部分，开发者往往会忽略它们，只关注 Nuxt 特有的优化——而 Nuxt 应用仍然是一个 Vue 项目。

**解决方案**：使用 `shallowRef`、`v-memo`、`v-once` 等概念来提升性能。

### 未遵循模式

**问题**：参与项目的人越多，维护稳定的代码库就越困难。开发者倾向于引入他们在其他项目中看到的新概念，这可能会导致冲突和性能问题。

**解决方案**：在项目中建立规则与模式，例如 [Vue 组合式函数的良好实践与设计模式](https://dev.to/jacobandrewsky/good-practices-and-design-patterns-for-vue-组合式函数-24lk)。

### 试图同时加载所有内容

**问题**：当页面加载时，如果未正确指定加载元素的顺序，就会导致同时获取所有内容——这可能会很慢，并导致糟糕的用户体验。

**解决方案**：使用渐进增强概念，先加载核心网页内容，然后在浏览器/互联网连接允许的情况下，再添加更细致、技术更复杂的展示层和功能。

## 有用资源

要了解更多提升性能的技术方法，请参考以下资源：

1. [使用 PRPL 模式实现即时加载](https://web.dev/articles/apply-instant-loading-with-prpl)
2. [感知性能](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Perceived_performance)
3. [理解关键渲染路径](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path)
