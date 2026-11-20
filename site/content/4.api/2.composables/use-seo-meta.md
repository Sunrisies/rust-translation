---
title: useSeoMeta
description: 该组合式函数允许你以完整的 TypeScript 支持形式定义网站的 SEO 元标签，将其视为一个扁平对象。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

这有助于避免常见错误，例如使用 `name` 而非 `property`，以及拼写错误——超过 100 个元标签都得到了完整类型定义。

::important
这是向网站添加元标签的推荐方式，因为它不会引发 XSS 攻击，并且具备完整的 TypeScript 支持。
::

:read-more{to="/docs/getting-started/seo-meta"}

## 使用方式

```vue [app/app.vue]
<script setup lang="ts">
useSeoMeta({
  title: 'My Amazing Site',
  ogTitle: 'My Amazing Site',
  description: 'This is my amazing site, let me tell you all about it.',
  ogDescription: 'This is my amazing site, let me tell you all about it.',
  ogImage: 'https://example.com/image.png',
  twitterCard: 'summary_large_image',
})
</script>
```

当插入需要反应式的标签时，应使用计算 getter 语法（`() => value`）：

```vue [app/app.vue]
<script setup lang="ts">
const title = ref('My title')

useSeoMeta({
  title,
  description: () => `This is a description for the ${title.value} page`,
})
</script>
```

## 参数

共有超过 100 个参数。请查看 [源代码中的完整参数列表](https://github.com/harlan-zw/zhead/blob/main/packages/zhead/src/metaFlat.ts#L1035)。

:read-more{to="/docs/getting-started/seo-meta"}

## 性能

在大多数情况下，SEO 元标签不需要是反应式的，因为搜索引擎机器人主要扫描初始页面加载内容。

为了获得更好的性能，当元标签不需要是反应式时，可以将 `useSeoMeta` 调用包裹在仅服务器执行的条件下：

```vue [app/app.vue]
<script setup lang="ts">
if (import.meta.server) {
  // These meta tags will only be added during server-side rendering
  useSeoMeta({
    robots: 'index, follow',
    description: 'Static description that does not need reactivity',
    ogImage: 'https://example.com/image.png',
    // other static meta tags...
  })
}

const dynamicTitle = ref('My title')
// Only use reactive meta tags outside the condition when necessary
useSeoMeta({
  title: () => dynamicTitle.value,
  ogTitle: () => dynamicTitle.value,
})
</script>
```

此方法之前使用 [`useServerSeoMeta`](/docs/api/组合式函数/use-server-seo-meta) 组合式函数，但现已弃用，转而采用此方式。
