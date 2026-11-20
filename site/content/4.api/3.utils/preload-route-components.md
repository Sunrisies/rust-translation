---
title: preloadRouteComponents
description: preloadRouteComponents 允许你在 Nuxt 应用中手动预加载各个页面。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/preload.ts
    size: xs
---

预加载路由会加载用户未来可能访问的指定路由的组件。这样能够确保这些组件更早可用，减少导航时的阻塞情况，从而提升性能。

::tip{icon="i-lucide-rocket"}
如果你使用 `NuxtLink` 组件，Nuxt 会自动预加载必要的路由。
::

:read-more{to="/docs/api/components/nuxt-link"}

## 示例

当使用 `navigateTo` 时，预加载一个路由。

```ts
// we don't await this async function, to avoid blocking rendering
// this component's setup function
preloadRouteComponents('/dashboard')

const submit = async () => {
  const results = await $fetch('/api/authentication')

  if (results.token) {
    await navigateTo('/dashboard')
  }
}
```

:read-more{to="/docs/api/utils/navigate-to"}

::note
在服务器环境下，`preloadRouteComponents` 将不起作用。
::
