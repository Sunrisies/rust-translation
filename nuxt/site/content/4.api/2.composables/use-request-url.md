---
title: useRequestURL
description: 使用组合式函数 useRequestURL 来访问传入的请求 URL。
minimalVersion: "3.5"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/url.ts
    size: xs
---

`useRequestURL` 是一个辅助函数，它返回一个在服务器端和客户端都可用的 [URL 对象](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL)。

::important
当使用带有缓存策略的 [混合渲染](/docs/guide/concepts/rendering#hybrid-rendering) 时，通过 [Nitro 缓存层](https://nitro.build/guide/cache) 处理缓存响应时，所有传入的请求头都会被丢弃（这意味着 `useRequestURL` 返回的 `host` 值将为 `localhost`）。

你可以定义 [`cache.varies` 选项](https://nitro.build/guide/cache#options)来指定在缓存和提供响应时需要考虑的头部信息，例如多租户环境中的 `host` 和 `x-forwarded-host`。
::

::code-group

```vue [app/pages/about.vue]
<script setup lang="ts">
const url = useRequestURL()
</script>

<template>
  <p>URL is: {{ url }}</p>
  <p>Path is: {{ url.pathname }}</p>
</template>
```

```html [Result in development]
<p>URL is: http://localhost:3000/about</p>
<p>Path is: /about</p>
```

::

::tip{icon="i-simple-icons-mdnwebdocs" to="https://developer.mozilla.org/en-US/docs/Web/API/URL#instance_properties" target="_blank"}
有关 MDN 文档中的 URL 实例属性的说明，请阅读相关内容。
::
