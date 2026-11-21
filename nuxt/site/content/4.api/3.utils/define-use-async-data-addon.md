---
title: defineUseAsyncDataAddon
description: 定义一个可复用的组合式函数，用于扩展通过 `createUseAsyncData` 创建的组合式函数。
minimalVersion: "4.6"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/addons.ts
    size: xs
---

`defineUseAsyncDataAddon` 定义了一个可复用的扩展函数，用于 `useAsyncData` 组合式函数，这些组合式函数是通过 [`createUseAsyncData`](/docs/api/组合式函数/create-use-async-data) 创建的。

组合式函数可以声明自定义调用站点选项，用中间件包裹处理程序，附加自定义响应式逻辑或扩展返回对象。

:read-more{to="/docs/api/utils/define-use-fetch-addon" title="defineUseFetchAddon: Addons for useAsyncData work the same way as useFetch addons"}

## 使用方式

例如，一个添加了 `pollEvery` 选项的组合式函数，该选项会在指定间隔时刷新数据：

```ts [app/composables/usePolledAsyncData.ts]
const polling = defineUseAsyncDataAddon({
  setup: (options: UseAsyncDataAddonOptions<{ pollEvery?: number }>) => {
    if (import.meta.server || !options.pollEvery) { return }
    return (asyncData) => {
      const interval = setInterval(() => asyncData.refresh(), options.pollEvery)
      onScopeDispose(() => clearInterval(interval))
    }
  },
})

export const usePolledAsyncData = createUseAsyncData({ addons: [polling] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// refreshes the data every 30 seconds
const { data } = await usePolledAsyncData(
  'mountains',
  () => $fetch('https://api.nuxtjs.dev/mountains'),
  { pollEvery: 30_000 },
)
</script>
```

::note
组合式函数按照 `addons` 数组的顺序运行，第一个组合式函数中的中间件作为最外层的包装器。重复列出同一个组合式函数对象只会运行一次。
::

## 类型

```ts [Signature]
function defineUseAsyncDataAddon<Opts extends Record<string, any> = {}, Ext = {}> (addon: {
  setup: (options: UseAsyncDataAddonOptions<Opts>) => ((asyncData: AsyncDataAddonInstance) => Ext | void) | void
}): UseAsyncDataAddon<Opts, Ext>
```
