---
title: useLazyAsyncData
description: 这个围绕 useAsyncData 的包装函数会立即触发导航。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

`useLazyAsyncData` 是一个围绕 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 的包装函数，通过将 `lazy` 选项设置为 `true`，可以在处理程序解析之前触发导航。

::note
默认情况下， [`useAsyncData`](/docs/api/组合式函数/use-async-data) 会阻止导航，直到其异步处理程序完成。`useLazyAsyncData` 则允许在后台继续数据获取的同时立即触发导航。
::

## 使用方式

```vue [app/pages/index.vue]
<script setup lang="ts">
const { status, data: posts } = await useLazyAsyncData('posts', () => $fetch('/api/posts'))
</script>

<template>
  <div>
    <div v-if="status === 'pending'">
      Loading...
    </div>
    <div v-else-if="status === 'error'">
      Error loading posts
    </div>
    <div v-else>
      {{ posts }}
    </div>
  </div>
</template>
```

`useLazyAsyncData` 允许在获取数据期间继续导航。在使用结果之前，请检查组件模板中的 `status === 'pending'` 和 `status === 'error'`。

::warning
`useLazyAsyncData` 是编译器转换后的保留函数名，因此不应将你的函数命名为 `useLazyAsyncData`。
::

## 类型

```ts [Signature]
export function useLazyAsyncData<ResT, DataE = unknown, DataT = ResT> (
  handler: AsyncDataHandler<ResT>,
  options?: AsyncDataOptions<ResT, DataT>,
): AsyncData<DataT, DataE> & Promise<AsyncData<DataT, DataE>>

export function useLazyAsyncData<ResT, DataE = unknown, DataT = ResT> (
  key: MaybeRefOrGetter<string>,
  handler: AsyncDataHandler<ResT>,
  options?: AsyncDataOptions<ResT, DataT>,
): AsyncData<DataT, DataE> & Promise<AsyncData<DataT, DataE>>
```

`useLazyAsyncData` 的签名与 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 相同。

## 参数

`useLazyAsyncData` 接受与 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 相同的参数，并且 `lazy` 选项会自动设置为 `true`。

:read-more{to="/docs/api/composables/use-async-data#parameters"}

## 返回值

`useLazyAsyncData` 返回的值与 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 相同。

:read-more{to="/docs/api/composables/use-async-data#return-values"}

## 示例

```vue [app/pages/index.vue]
<script setup lang="ts">
/* useLazyAsyncData lets navigation continue before the fetch completes.
  Handle loading and error states in the template.
*/
const { status, data: count } = await useLazyAsyncData('count', () => $fetch('/api/count'))

watch(count, (newCount) => {
  // Because count might start out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>

<template>
  <div v-if="status === 'pending'">
    Loading
  </div>
  <div v-else-if="status === 'error'">
    Error loading count
  </div>
  <div v-else>
    {{ count }}
  </div>
</template>
```

:read-more{to="/docs/getting-started/data-fetching"}
