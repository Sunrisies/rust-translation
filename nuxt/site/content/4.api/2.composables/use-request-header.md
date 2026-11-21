---
title: useRequestHeader
description: 使用 useRequestHeader 可以访问特定的传入请求头。
minimalVersion: "3.9"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

您可以使用内置的 [`useRequestHeader`](/docs/api/组合式函数/use-request-header) 组合式函数来访问页面、组件和插件中的任何传入请求头。

```ts
// Get the authorization request header
const authorization = useRequestHeader('authorization')
```

::tip
在浏览器中，`useRequestHeader` 将返回 `undefined`。
::

## 示例

我们可以使用 `useRequestHeader` 轻松判断用户是否获得授权。

下面的示例读取 `authorization` 请求头，以判断某人是否可以访问受限制资源。

```ts [app/middleware/authorized-only.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  if (!useRequestHeader('authorization')) {
    return navigateTo('/not-authorized')
  }
})
```
