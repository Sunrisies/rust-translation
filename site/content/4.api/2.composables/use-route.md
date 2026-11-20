---
title: useRoute
description: 组合式函数 useRoute 返回当前路由信息。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::note
在 Vue 组件的模板中，可以使用 `$route` 访问路由信息。
::

`useRoute` 组合式函数是 `vue-router` 中同名组合式函数的包装器，可在 Nuxt 应用中访问当前路由信息。

关键区别在于，在 Nuxt 中，该组合式函数确保仅在页面内容在导航后发生变化后才会更新路由。
相比之下，`vue-router` 版本会立即更新路由，这可能导致依赖路由元数据的模板不同部分出现同步问题。
例如，这些部分依赖于路由元数据。

## 示例

在以下示例中，我们通过动态页面参数 `slug` 作为 URL 的一部分，通过 [`useFetch`](/docs/api/组合式函数/use-fetch) 调用 API。

```html [~/pages/[slug\\].vue]
<script setup lang="ts">
const route = useRoute()
const { data: mountain } = await useFetch(`/api/mountains/${route.params.slug}`)
</script>

<template>
  <div>
    <h1>{{ mountain.title }}</h1>
    <p>{{ mountain.description }}</p>
  </div>
</template>
```

如果您需要访问路由查询参数（例如路径 `/test?example=true` 中的 `example`），则可以使用 `useRoute().query` 而不是 `useRoute().params`。

## API

除了动态参数和查询参数外，`useRoute()` 还提供以下与当前路由相关的计算引用：

- `fullPath`: 与当前路由相关的编码 URL，包含路径、查询和哈希部分。
- `hash`: 解码后的 URL 哈希部分，以 `#` 开头。
- `query`: 访问路由查询参数。
- `matched`: 包含当前路由位置的规范化匹配路由数组。
- `meta`: 附加到记录上的自定义数据。
- `name`: 路由记录的唯一名称。
- `path`: URL 的编码路径部分。
- `redirectedFrom`: 在最终定位到当前路由位置之前尝试访问的路由位置。

## 常见陷阱

### 路由同步问题

使用 Nuxt 中的 `useRoute()` 组合式函数而非 `vue-router` 中的版本，可以避免页面导航时的同步问题。
直接从 `vue-router` 导入 `useRoute` 会绕过 Nuxt 的实现机制。

```ts twoslash
// ❌ do not use `useRoute` from `vue-router`
// @errors: 2300
import { useRoute } from 'vue-router'
// ✅ use Nuxt's `useRoute` composable
import { useRoute } from '#app'
```

### 在中间件中调用 `useRoute`

在中间件中使用 `useRoute` 并不推荐，因为它可能导致意外行为。
中间件中没有“当前路由”的概念。
`useRoute()` 组合式函数应仅在 Vue 组件的 setup 函数中或 Nuxt 插件中使用。

::warning
这同样适用于任何在内部使用 `useRoute()` 的组合式函数。
::

::read-more{to="/docs/directory-structure/app/middleware"}
关于在中间件部分如何访问路由的更多信息，请参考相关章节。
::

### `route.fullPath` 引起的 hydration 问题

浏览器在发起请求时不会发送 [URL 片段](https://url.spec.whatwg.org/#concept-url-fragment)（例如 `#foo`）。因此，使用 `route.fullPath` 来影响模板可能会引发 hydration 问题，因为这将把片段包含在客户端中，而服务器中则不包含。

:read-more{icon="i-simple-icons-vuedotjs" to="https://router.vuejs.org/api/type-aliases/RouteLocationNormalizedLoaded.html"}
