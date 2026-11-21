---
navigation.title: 'Accessibility'
title: Nuxt 可访问性
description: Nuxt 应用可访问性的最佳实践。
---

使应用具备可访问性的大部分要素并非 Nuxt 所独有：颜色对比度、表单语义和 ARIA 功能与任何 Vue 或纯 HTML 应用相同，本指南最后的 [资源](#useful-resources) 部分对它们有详细的说明。

Nuxt 改变的是导航机制。一旦应用完成初始化，它会在客户端进行路由处理，因此文档不会重新加载，浏览器也不会提示新页面或重置焦点。Nuxt 提供了一些功能来填补这一空白，一些约定则能解决其余问题。本指南概述了处理这些问题的最佳实践。

::tip
[`@nuxt/a11y`](https://github.com/nuxt/a11y) 可在开发过程中在组件中显示可访问性问题，并附带以下最佳实践说明。该工具处于 alpha 版本，因此预计其 API 会发生变化。
::

## 路由提示

屏幕阅读器可以自行提示页面完全加载完成，但它们无法知道客户端进行了导航。 [`<NuxtRouteAnnouncer>`](/docs/api/components/nuxt-route-announer) 通过渲染一个隐藏的实时区域，并在每次导航后将新页面的标题写入其中来解决这一问题。

```vue [app.vue]
<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
```

提示器读取 Unhead 渲染的标题，因此其有效性取决于标题的质量。如果两条路由拥有相同的 `<title>`，用户在切换时不会听到任何提示。

当需要提示其他内容，或需要改变提示的紧急程度时，请使用 [`useRouteAnnouncer`](/docs/api/组合式函数/use-route-announcer)。

```vue [app/pages/search.vue]
<script setup lang="ts">
const { set } = useRouteAnnouncer()
const { data: results } = await useFetch('/api/search')

watch(results, (results) => {
  set(`${results?.length ?? 0} results found`)
})
</script>
```

:read-more{title="NuxtRouteAnnouncer 监听器" to="/docs/api/components/nuxt-route-announcer"}

对于非导航的页面内更新，如表单验证或提示信息，应使用 [`<NuxtAnnouncer>`](/docs/api/components/nuxt-announcer) 并结合 [`useAnnouncer`](/docs/api/组合式函数/use-announer)。

## 页面标题

由于路由提示器遵循文档标题，为每条路由设置独特的标题是你能做的最有价值的事情。在 `app.vue` 中设置全局模板，然后让每个页面自行填充其部分内容。

```vue [app.vue]
<script setup lang="ts">
useHead({
  titleTemplate: title => title ? `${title} - Nuxt` : 'Nuxt',
})
</script>
```

```vue [app/pages/about.vue]
<script setup lang="ts">
useHead({
  title: 'About us',
})
</script>
```

如果标题来自路由元数据而非页面本身，可以在布局中通过 [`useRoute`](/docs/api/组合式函数/use-route) 读取 [`definePageMeta`](/docs/directory-structure/app/pages#page-metadata) 的值。

:read-more{title="SEO 与元标签" to="/docs/getting-started/seo-meta#dynamic-title"}

## 链接

使用 [`<NuxtLink>`](/docs/api/components/nuxt-link) 进行页面内导航。它渲染真实的 `<a href="...">`，这意味着它可聚焦、符合标签页顺序，并且支持中键点击和“在新标签页打开”，这些功能都需要你在带有 `@click` 处理器的 `<div>` 上重新实现 `navigateTo` 函数。

```vue
<template>
  <NuxtLink to="/about">About page</NuxtLink>
</template>
```

在菜单或面包屑中，与当前路由匹配的链接已包含 `aria-current="page"`，因此辅助技术可以知道您处于哪个项目。如果不同的标记能更好地描述关系，例如多页面表单中的步骤，请设置 [`ariaCurrentValue`](/docs/api/components/nuxt-link#routerlink)：

```vue
<template>
  <NuxtLink
    to="/checkout/payment"
    aria-current-value="step"
  >Payment</NuxtLink>
</template>
```

指向 `public/` 目录中的文件或同一源站上的其他应用的链接不是 Vue Router 所识别的路由。将其标记为 [`external`](/docs/api/components/nuxt-link#handling-static-file-and-cross-app-links)，这样浏览器会执行真正的导航操作，而不是无法匹配路由。

:read-more{title="NuxtLink 链接" to="/docs/api/components/nuxt-link"}

## 焦点管理

客户端导航后，焦点会保持在原处，通常是用户刚刚激活的链接。Vue Router 和 Nuxt 都不会移动焦点，因此键盘用户可能需要重新通过标签页浏览整个标题栏以访问刚刚更改的内容。

作为应用第一个标签页停止点的跳过链接是传统的解决方案，并且在初始页面加载时也有帮助：

```vue [app.vue]
<template>
  <a
    class="skip-link"
    href="#main"
  >Skip to main content</a>
  <AppHeader />
  <main
    id="main"
    tabindex="-1"
  >
    <NuxtPage />
  </main>
</template>

<style>
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  position: static;
}
</style>
```

`<main>` 本身不可聚焦，因此需要 `tabindex="-1"` 才能接受来自跳过链接或脚本的焦点。使用 `-1` 而不是正值，否则会移动元素在标签页中的顺序并让其他用户感到惊讶。

如果适合您的应用，还可以通过插件在每次导航后将焦点移动到主区域：

```ts [app/plugins/focus-main.client.ts]
export default defineNuxtPlugin(() => {
  useRouter().afterEach((to, from) => {
    if (to.path === from.path) {
      return
    }
    nextTick(() => document.getElementById('main')?.focus())
  })
})
```

::tip
仅使用键盘在应用中导航。经过几次导航后从跳过链接进入 `<main>` 时，大多数焦点问题会迅速显现出来。
::

## 滚动行为

Nuxt 在新路由时滚动到顶部，用户返回时恢复之前的位置，并滚动到哈希目标。如果您需要不同的行为，例如平滑滚动或不同的偏移量，请配置 [`scrollBehaviorType`](/docs/guide/recipes/custom-routing#scroll-behavior-for-hash-links)或在 [`router.options.ts`](/docs/guide/recipes/custom-routing#router-options)中编写自己的 `scrollBehavior`。请注意，平滑滚动应尊重用户的 `prefers-reduced-motion` 设置。

:read-more{title="自定义路由" to="/docs/guide/recipes/custom-routing"}

## 有用资源

- [Web 可访问性倡议 (WAI)](https://www.w3.org/WAI/)
- [MDN：可访问性](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [了解 WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)
