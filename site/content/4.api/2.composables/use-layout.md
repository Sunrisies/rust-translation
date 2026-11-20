---
title: useLayout
description: useLayout 返回当前路由对应的布局结果。
minimalVersion: "4.5"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/layout.ts
    size: xs
---

## 描述

`useLayout` 返回一个计算式引用，该引用包含当前路由的布局结果，其调用链与 [`<NuxtLayout>`](/docs/api/components/nuxt-layout) 相同：首先使用页面的 `layout` meta，然后使用通过 [route rules](/docs/guide/concepts/rendering#hybrid-rendering) 设置的 `appLayout`，最后为 `'default'`。

在渲染后的 `<NuxtLayout>` 内部，它反映包含该布局的布局；在外部（例如 `app.vue` 中），它返回当前路由对应的布局结果。

与直接读取 `route.meta.layout` 不同，此方式考虑了通过 route rules 设置的布局，并能在路由变化时保持同步。

## 返回值

一个只读计算式引用，指向布局名称（类型为 `string`），当布局被禁用时返回 `false`。

## 示例

```vue [app.vue]
<script setup lang="ts">
const layout = useLayout()
</script>

<template>
  <div>
    <CommandPalette v-if="layout !== 'minimal'" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
```
