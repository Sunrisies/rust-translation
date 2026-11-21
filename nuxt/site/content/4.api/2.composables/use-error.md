---
title: useError
description: useError 组合式函数返回正在处理的全局 Nuxt 错误。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

## 使用方式

`useError` 组合式函数返回正在处理的全局 Nuxt 错误，该函数在客户端和服务器上均可用。它提供了贯穿整个应用的可响应式、适合 SSR 的错误处理状态。

```ts
const error = useError()
```

你可以在组件、页面或插件中使用此组合式函数来访问或响应当前的 Nuxt 错误。

## 类型

```ts
interface NuxtError<DataT = unknown> {
  status: number
  statusText?: string
  message: string
  data?: DataT
  cause?: unknown
  fatal: boolean
}

export const useError: () => Ref<NuxtError | undefined>
```

## 参数

此组合式函数不接收任何参数。

## 返回值

返回一个包含当前 Nuxt 错误的 `Ref`（如果没有错误则返回 `undefined`）。错误对象是可响应性的，当错误状态发生变化时会自动更新。

## 示例

```vue
<script setup lang="ts">
const error = useError()

if (error.value) {
  console.error('Nuxt error:', error.value)
}
</script>
```

:read-more{to="/docs/getting-started/error-handling"}
