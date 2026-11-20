---
title: setPageLayout
description: setPageLayout 允许你动态改变页面的布局。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::important
`setPageLayout` 允许你动态改变页面的布局。它依赖于对 Nuxt 上下文的访问，因此只能在 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)中调用。
::

```ts [app/middleware/custom-layout.ts]
export default defineNuxtRouteMiddleware((to) => {
  // Set the layout on the route you are navigating _to_
  setPageLayout('other')
})
```

## 向布局传递 Props :badge[v4.3]{color="info" size="xs" class="align-middle"}

你可以通过将对象作为第二个参数传递给布局来传递 Props：

```ts [app/middleware/admin-layout.ts]
export default defineNuxtRouteMiddleware((to) => {
  setPageLayout('admin', {
    sidebar: true,
    title: 'Dashboard',
  })
})
```

然后，布局可以接收这些 Props：

```vue [app/layouts/admin.vue]
<script setup lang="ts">
const props = defineProps<{
  sidebar?: boolean
  title?: string
}>()
</script>

<template>
  <div>
    <aside v-if="sidebar">
      Sidebar
    </aside>
    <main>
      <h1>{{ title }}</h1>
      <slot />
    </main>
  </div>
</template>
```

::note
如果你选择在服务器端动态设置布局，必须确保在 Vue 渲染布局之前完成此操作（即，在插件或路由中间件中），以避免 hydration 不匹配问题。
::
