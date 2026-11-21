---
title: useServerSeoMeta
description: 组合式函数 `useServerSeoMeta` 允许你以完整的 TypeScript 支持形式定义网站的 SEO 元标签，将其作为一个扁平对象来使用。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

::warning
`useServerSeoMeta` 已弃用。请将 [`useSeoMeta`](/docs/api/组合式函数/use-seo-meta) 包裹在 `if (import.meta.server)` 块中替代。在 `future.compatibilityVersion: 5` 版本下，自动导入功能将被移除。
::

`useServerSeoMeta` 允许你以完整的 TypeScript 支持形式定义网站的 SEO 元标签，其工作方式与 [`useSeoMeta`](/docs/api/组合式函数/use-seo-meta) 完全相同，但它仅在服务器端运行，并且会从客户端打包中消除。

:read-more{to="/docs/api/composables/use-seo-meta"}

对于新代码，直接采用仅服务器端使用的模式即可：

```vue [app/app.vue]
<script setup lang="ts">
if (import.meta.server) {
  useSeoMeta({
    robots: 'index, follow',
  })
}
</script>
```

参数与 [`useSeoMeta`](/docs/api/组合式函数/use-seo-meta) 中的参数完全一致。

:read-more{to="/docs/getting-started/seo-meta"}
