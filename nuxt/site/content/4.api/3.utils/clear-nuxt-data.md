---
title: clearNuxtData
description: 删除 `useAsyncData` 和 `useFetch` 的缓存数据、错误状态及待处理承诺。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

::note
此方法适用于您希望使其他页面停止数据获取的情况。
::

## 类型

```ts [Signature]
export function clearNuxtData (keys?: string | string[] | ((key: string) => boolean)): void
```

## 参数

* `keys`: 用于 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 的键之一或数组，用于删除其缓存数据。如果未提供任何键，则**所有数据**将被失效。
