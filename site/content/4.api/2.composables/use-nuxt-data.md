---
title: useNuxtData
description: 访问数据获取组合式函数的当前缓存值。
minimalVersion: "3.1"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

::note
`useNuxtData` 允许你访问 [`useAsyncData`](/docs/api/组合式函数/use-async-data)、 [`useLazyAsyncData`](/docs/api/组合式函数/use-lazy-async-data)、 [`useFetch`](/docs/api/组合式函数/use-fetch) 和 [`useLazyFetch`](/docs/api/组合式函数/use-lazy-fetch) 的当前缓存值，只需提供明确的键即可。
::

## 使用方式

`useNuxtData` 组合式函数用于访问 `useAsyncData`、`useLazyAsyncData`、`useFetch` 和 `useLazyFetch` 等数据获取组合式函数的当前缓存值。通过提供数据获取时使用的键，你可以获取缓存数据并按需使用它。

这对于通过重用已获取的数据来优化性能，或实现乐观更新或级联数据更新等功能非常有用。

要使用 `useNuxtData`，请确保数据获取组合式函数（`useFetch`、`useAsyncData` 等）已使用明确的键调用。

:video-accordion{title="Watch a video from LearnVue about useNuxtData" videoId="e-_u6swXRWk"}

## 类型

```ts [Signature]
export function useNuxtData<DataT = any> (key: string): { data: Ref<DataT | undefined> }
```

## 参数

- `key`: 识别缓存数据的唯一键。该键应与原始数据获取时使用的键一致。

## 返回值

- `data`: 与提供的键相关的缓存数据的响应式引用。如果不存在缓存数据，则值为 `undefined`。此 `Ref` 在缓存数据发生变化时会自动更新，从而在你的组件中实现无缝的响应式特性。

## 示例

下面的示例展示了如何在从服务器获取最新数据期间将缓存数据作为占位符使用。

```vue [app/pages/posts.vue]
<script setup lang="ts">
// We can access same data later using 'posts' key
const { data } = await useFetch('/api/posts', { key: 'posts' })
</script>
```

```vue [app/pages/posts/[id\\].vue]
<script setup lang="ts">
// Access to the cached value of useFetch in posts.vue (parent route)
const { data: posts } = useNuxtData('posts')

const route = useRoute()

const { data } = useLazyFetch(`/api/posts/${route.params.id}`, {
  key: `post-${route.params.id}`,
  default () {
    // Find the individual post from the cache and set it as the default value.
    return posts.value.find(post => post.id === route.params.id)
  },
})
</script>
```

## 乐观更新

下面的示例展示了如何使用 `useNuxtData` 实现乐观更新。

乐观更新是一种技术，它假设服务器操作会成功，从而立即更新用户界面。如果操作最终失败，UI 将回滚到之前的状态。

```vue [app/pages/todos.vue]
<script setup lang="ts">
// We can access same data later using 'todos' key
const { data } = await useAsyncData('todos', (_nuxtApp, { signal }) => $fetch('/api/todos', { signal }))
</script>
```

```vue [app/components/NewTodo.vue]
<script setup lang="ts">
const newTodo = ref('')
let previousTodos = []

// Access to the cached value of useAsyncData in todos.vue
const { data: todos } = useNuxtData('todos')

async function addTodo () {
  await $fetch('/api/addTodo', {
    method: 'post',
    body: {
      todo: newTodo.value,
    },
    onRequest () {
      // Store the previously cached value to restore if fetch fails.
      previousTodos = todos.value

      // Optimistically update the todos.
      todos.value = [...todos.value, newTodo.value]
    },
    onResponseError () {
      // Rollback the data if the request failed.
      todos.value = previousTodos
    },
    async onResponse () {
      // Invalidate todos in the background if the request succeeded.
      await refreshNuxtData('todos')
    },
  })
}
</script>
```
