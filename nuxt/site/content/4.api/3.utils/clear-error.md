---
title: clearError
description: 组合式函数 clearError 会清除所有已处理的错误。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

在您的页面、组件和插件中，可以使用 `clearError` 来清除所有错误并引导用户重定向。

**参数：**

- `options?: { redirect?: string }`

您可以提供一个可选的重定向路径（例如，如果您希望导航到某个“安全”页面）。

```ts
// Without redirect
clearError()

// With redirect
clearError({ redirect: '/homepage' })
```

错误是通过 [`useError()`](/docs/api/组合式函数/use-error) 在状态中设置的。组合式函数 clearError 会重置该状态，并根据提供的选项调用 `app:error:cleared` 钩子。

:read-more{to="/docs/getting-started/error-handling"}
