---
title: useLazyFetch
description: 这个围绕 useFetch 的包装函数会立即触发导航。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

`useLazyFetch` 是一个围绕 [`useFetch`](/docs/api/组合式函数/use-fetch) 的包装函数，通过将 `lazy` 选项设置为 `true`，在 handler 解析之前触发导航。

## 使用方式

默认情况下， [`useFetch`](/docs/api/组合式函数/use-fetch) 会阻止导航，直到其异步 handler 被解析。`useLazyFetch` 允许立即进行导航，数据在后台获取。

```vue [app/pages/index.vue]
<script setup lang="ts">
const { status, data: posts } = await useLazyFetch('/api/posts')
</script>

<template>
  <div v-if="status === 'pending'">
    Loading ...
  </div>
  <div v-else-if="status === 'error'">
    Error loading posts
  </div>
  <div v-else>
    <div v-for="post in posts">
      <!-- do something -->
    </div>
  </div>
</template>
```

::note
`useLazyFetch` 的签名与 [`useFetch`](/docs/api/组合式函数/use-fetch) 相同。
::

::warning
`useLazyFetch` 的初始化会发起调用，但不会等待数据。在客户端导航期间，在组件模板中检查 `status === 'pending'` 和 `status === 'error'`，再使用结果。
::

::warning
`useLazyFetch` 是一个被编译器转换过的保留函数名，因此你不应该将你的函数命名为 `useLazyFetch`。
::

## 类型

```ts [Signature]
export function useLazyFetch<ResT, ErrorT = NuxtError<unknown>, DataT = ResT> (
  url: string | Request | Ref<string | Request> | (() => string | Request),
  options?: UseFetchOptions<ResT, DataT>,
): AsyncData<DataT, ErrorT> & Promise<AsyncData<DataT, ErrorT>>
```

::note
`useLazyFetch` 等同于设置 `lazy: true` 选项的 `useFetch`。有关完整的类型定义，请参阅 [`useFetch`](/docs/api/组合式函数/use-fetch)。
::

## 参数

`useLazyFetch` 接受与 [`useFetch`](/docs/api/组合式函数/use-fetch) 相同的参数：

- `URL` (`string | Request | Ref<string | Request> | () => string | Request`): 要获取的 URL 或请求。
- `options` (object): 与 [`useFetch` 选项](/docs/api/组合式函数/use-fetch#parameters)相同，且 `lazy` 自动设置为 `true`。

:read-more{to="/docs/api/composables/use-fetch#parameters"}

## 返回值

返回与 [`useFetch`](/docs/api/组合式函数/use-fetch) 相同的 `AsyncData` 对象：

| 名称      | 类型                                                | 描述                                                                                                      |
|-----------|-----------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| `data`    | `Ref<DataT \| undefined>`                           | 异步获取的结果。                                                                            |
| `refresh` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | 手动刷新数据的函数。                                                                           |
| `execute` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | `refresh` 的别名。                                                                                     |
| `error`   | `Ref<ErrorT \| undefined>`                          | 数据获取失败时的错误对象。                                                                        |
| `status`  | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>`  | 数据请求的状态。用于区分 `idle`、`pending`、`success` 和 `error`。                     |
| `pending` | `Ref<boolean>`                                      | 请求正在处理时的值为 `true`。参见 [`useFetch`](/docs/api/组合式函数/use-fetch#return-values)。        |
| `clear`   | `() => void`                                        | 将 `data` 重置为 `undefined`，将 `error` 重置为 `undefined`，将 `status` 设置为 `idle`，并取消所有待处理请求。 |

:read-more{to="/docs/api/composables/use-fetch#return-values"}

## 示例

### 加载状态处理

```vue [app/pages/index.vue]
<script setup lang="ts">
/* useLazyFetch lets navigation continue before the fetch completes.
 * Handle loading and error states in the template.
 */
const { status, data: posts } = await useLazyFetch('/api/posts')
watch(posts, (newPosts) => {
  // Because posts might start out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>

<template>
  <div v-if="status === 'pending'">
    Loading ...
  </div>
  <div v-else-if="status === 'error'">
    Error loading posts
  </div>
  <div v-else>
    <div v-for="post in posts">
      <!-- do something -->
    </div>
  </div>
</template>
```

:read-more{to="/docs/getting-started/data-fetching"}
