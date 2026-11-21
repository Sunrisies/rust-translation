---
title: createUseAsyncData
description: 一个工厂函数，用于创建带有预定义默认选项的自定义组合式函数 useAsyncData。
minimalVersion: "4.4"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

`createUseAsyncData` 创建一个带有预定义选项的自定义 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 组合式函数。生成的组合式函数具有完整的类型信息，其行为与 `useAsyncData` 完全相同，但默认选项已内置其中。

::note
`createUseAsyncData` 是一个编译器宏。它必须作为 **导出** 声明使用在 `composables/` 目录中（或任何被 Nuxt 编译器扫描的目录中）。Nuxt 会在构建时自动注入去重键。
::

## 使用方式

```ts [app/composables/useCachedData.ts]
export const useCachedData = createUseAsyncData({
  getCachedData (key, nuxtApp) {
    return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  },
})
```

```vue [app/pages/index.vue]
<script setup lang="ts">
const { data: mountains } = await useCachedData(
  'mountains',
  () => $fetch('https://api.nuxtjs.dev/mountains'),
)
</script>
```

生成的组合式函数具有与 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 相同的签名和返回类型，所有选项都可供调用者使用或覆盖。

## 类型

```ts [Signature]
function createUseAsyncData (
  options?: Partial<AsyncDataOptions> & { addons?: UseAsyncDataAddon[] },
): typeof useAsyncData

function createUseAsyncData (
  options: (callerOptions: AsyncDataOptions) => Partial<AsyncDataOptions>,
): typeof useAsyncData
```

返回的组合式函数的签名包含由 [addons](#addons) 提供的任何自定义选项和返回值扩展。

## 选项

`createUseAsyncData` 接受与 [`useAsyncData`](/docs/api/组合式函数/use-async-data#parameters) 相同的所有选项，包括 `server`、`lazy`、`immediate`、`default`、`transform`、`pick`、`getCachedData`、`deep`、`dedupe`、`timeout` 和 `watch`。

请查看 [`useAsyncData` 文档](/docs/api/组合式函数/use-async-data#parameters)中的完整选项列表。

## 默认模式与覆盖模式

### 默认模式（纯对象）

当传递纯对象时，工厂选项作为 **默认值** 使用。调用者可以覆盖任何选项：

```ts [app/composables/useLazyData.ts]
export const useLazyData = createUseAsyncData({
  lazy: true,
  server: false,
})
```

```ts
// Uses the defaults (lazy: true, server: false)
const { data } = await useLazyData('key', () => fetchSomeData())

// Caller overrides server to true
const { data } = await useLazyData('key', () => fetchSomeData(), { server: true })
```

### 覆盖模式（函数）

当传递函数时，工厂选项 **覆盖** 调用者的选项。该函数将调用者的选项作为其参数接收：

```ts [app/composables/useStrictData.ts]
// deep is always enforced as false
export const useStrictData = createUseAsyncData(callerOptions => ({
  deep: false,
}))
```

## Addons

除了 `useAsyncData` 选项，`createUseAsyncData` 还接受 `addons` 数组。Addons 是可重复使用的行为单元，通过 [`defineUseAsyncDataAddon`](/docs/api/utils/define-use-async-data-addon) 定义。它们可以声明自定义调用点选项、在处理器周围运行中间件、扩展返回的对象，并向组合式函数附加自定义逻辑。

例如，一个 addon 会在窗口重新获得焦点时刷新数据，并通过自定义的 `refreshOnFocus` 选项进行保护，因此调用者需要在每次调用时选择启用此功能。

```ts [app/composables/useCustomAsyncData.ts]
const refreshOnFocus = defineUseAsyncDataAddon({
  // augment the call-site options for the custom useAsyncData instance 👇
  setup: (options: UseAsyncDataAddonOptions<{ refreshOnFocus?: boolean }>) => {
    // 👈 run code *before* creating the `useAsyncData` instance
    if (import.meta.server || !options.refreshOnFocus) { return }

    return (asyncData) => {
      // 👈 run code *after* creating the `useAsyncData` instance
      const focused = useWindowFocus()
      watch(focused, (focused) => {
        if (focused) { asyncData.refresh() }
      })

      return { focused } // 👈 extend the returned object with a new property
    }
  },
})

export const useCustomAsyncData = createUseAsyncData({ addons: [refreshOnFocus] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// `refreshOnFocus` is typed on the created composable
const { data } = await useCustomAsyncData(
  'mountains',
  () => $fetch('https://api.nuxtjs.dev/mountains'),
  { refreshOnFocus: true },
)
</script>
```

:read-more{to="/docs/api/utils/define-use-async-data-addon"}

:read-more{to="/docs/guide/recipes/custom-usefetch"}

:read-more{to="/docs/api/composables/use-async-data"}
