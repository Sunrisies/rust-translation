---
title: showError
description: Nuxt 提供了一种快速简单的方法，在需要时显示全屏错误页面。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

在 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)中，你可以使用 `showError` 来显示错误。

**参数：**

- `error`: `string | Error | Partial<{ cause, data, message, name, stack, status, statusText }>`

```ts
showError('😱 Oh no, an error has been thrown.')
showError({
  status: 404,
  statusText: 'Page Not Found',
})
```

错误信息通过 [`useError()`](/docs/api/组合式函数/use-error) 设置到状态中，从而在整个组件之间创建一个响应式且适合 SSR 的共享错误状态。

::tip
`showError` 会调用 `app:error` 钩子。
::

:read-more{to="/docs/getting-started/error-handling"}
