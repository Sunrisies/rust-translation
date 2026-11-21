---
title: prerenderRoutes
description: prerenderRoutes 提示需要预渲染额外的路由。
minimalVersion: "3.8"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

在预渲染过程中，你可以提示需要预渲染额外的路径，即使这些路径的 URL 不会出现在生成的页面 HTML 中。Nuxt 会收集这些提示并将其传递给服务器构建器的 prerenderer（默认使用 Nitro）。

::important
`prerenderRoutes` 只能在 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)中调用。
::

::note
`prerenderRoutes` 必须在预渲染期间执行。如果 `prerenderRoutes` 用于未进行预渲染的动态页面/路由，则不会执行。
::

```ts
const route = useRoute()

prerenderRoutes('/')
prerenderRoutes(['/', '/about'])
```

::note
在浏览器中或预渲染之外调用 `prerenderRoutes` 将不会产生效果。
::

你甚至可以预渲染 API 路由，这对于完全静态生成的网站（SSG）非常有用，因为你可以像使用服务器一样使用 `$fetch` 获取数据！

```ts
prerenderRoutes('/api/content/article/name-of-article')

// Somewhere later in App
const articleContent = await $fetch('/api/content/article/name-of-article', {
  responseType: 'json',
})
```

::warning
在生产环境中，预渲染的 API 路由可能不会返回预期的响应头，这取决于你部署的提供方。例如，JSON 响应可能会以 `application/octet-stream` 内容类型呈现。
在获取预渲染的 API 路由时，务必手动设置 `responseType`。
::
