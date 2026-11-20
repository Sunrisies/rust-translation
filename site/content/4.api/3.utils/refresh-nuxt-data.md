---
title: refreshNuxtData
description: 在 Nuxt 中刷新所有或特定的 asyncData 实例
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

`refreshNuxtData` 用于重新获取所有或特定的 `asyncData` 实例，包括来自 [`useAsyncData`](/docs/api/组合式函数/use-async-data)、[`useLazyAsyncData`](/docs/api/组合式函数/use-lazy-async-data)、[`useFetch`](/docs/api/组合式函数/use-fetch) 和 [`useLazyFetch`](/docs/api/组合式函数/use-lazy-fetch) 的实例。

::note
如果您的组件被 `<KeepAlive>` 缓存并进入停用状态，组件内的 `asyncData` 仍会重新获取，直到组件被卸载。
::

## 类型

```ts [Signature]
export function refreshNuxtData (keys?: string | string[])
```

## 参数

* `keys`: 用于获取数据的单个字符串或字符串数组。此参数为**可选**。当未明确指定 `keys` 时，所有 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 和 [`useFetch`](/docs/api/组合式函数/use-fetch) 的 `keys` 都会重新获取。

## 返回值

`refreshNuxtData` 返回一个承诺，当所有或特定的 `asyncData` 实例被重新获取时，该承诺将被解决。

## 示例

### 刷新所有数据

以下示例将刷新 Nuxt 应用中使用 `useAsyncData` 和 `useFetch` 获取的所有数据。

```vue [app/pages/some-page.vue]
<script setup lang="ts">
const refreshing = ref(false)

async function refreshAll () {
  refreshing.value = true
  try {
    await refreshNuxtData()
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div>
    <button
      :disabled="refreshing"
      @click="refreshAll"
    >
      Refetch All Data
    </button>
  </div>
</template>
```

### 刷新特定数据

以下示例仅重新获取键与 `count` 和 `user` 匹配的数据。

```vue [app/pages/some-page.vue]
<script setup lang="ts">
const refreshing = ref(false)

async function refresh () {
  refreshing.value = true
  try {
    // you could also pass an array of keys to refresh multiple data
    await refreshNuxtData(['count', 'user'])
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div v-if="refreshing">
    Loading
  </div>
  <button @click="refresh">
    Refresh
  </button>
</template>
```

::note
如果您可以访问 `asyncData` 实例，建议使用其 `refresh` 或 `execute` 方法作为重新获取数据的首选方式。
::

:read-more{to="/docs/getting-started/data-fetching"}
