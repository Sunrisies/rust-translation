---
title: defineRouteRules
description: 在页面级别定义混合渲染的路由规则。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/pages/runtime/composables.ts
    size: xs
---

::read-more{to="/docs/guide/going-further/experimental-features#inlinerouterules" icon="i-lucide-star"}
此功能为实验性功能，要使用它，必须在 `nuxt.config` 中启用 `experimental.inlineRouteRules` 选项。
::

## 使用方式

```vue [app/pages/index.vue]
<script setup lang="ts">
defineRouteRules({
  prerender: true,
})
</script>

<template>
  <h1>Hello world!</h1>
</template>
```

将翻译为：

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
  },
})
```

::note
当运行 [`nuxt build`](/docs/api/commands/build) 时，首页将在 `.output/public/index.html` 中预渲染并静态服务。
::

## 注意事项

- 在 `~/pages/foo/bar.vue` 中定义的规则将适用于 `/foo/bar` 请求。
- 在 `~/pages/foo/[id].vue` 中定义的规则将适用于 `/foo/*` 请求。
- 在具有有限选项集的页面中定义的规则，例如自定义 `path` `/:locale(en|fr)/about`，将为每个选项生成一条规则（`/en/about` 和 `/fr/about`）。

如果页面路径无法转换为等效的路由规则模式（例如，带有正则表达式的参数 `/:id(\d+)`，部分片段 `/prefix-:id`，或可重复的参数 `/:slug+`），则该页面的规则**不会**被应用，Nuxt 在构建过程中会发出警告。在这种情况下，应在 `nuxt.config` 中的 `nitro.routeRules` 中显式定义规则。

为了获得更多控制，例如当您使用页面中的自定义 `path` 或 `alias` 设置 `[definePageMeta](/docs/api/utils/define-page-meta)` 时，应在 `nuxt.config` 中直接设置 `routeRules`。

::read-more{to="/docs/guide/concepts/rendering#hybrid-rendering" icon="i-lucide-medal"}
了解更多关于 `routeRules` 的信息。
::
