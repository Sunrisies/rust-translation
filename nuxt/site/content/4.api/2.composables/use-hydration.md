---
title: useHydration
description: 允许完全控制 hydration 流程，以便在服务器端设置数据并在客户端接收数据。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/hydrate.ts
    size: xs
---

`useHydration` 是一个内置组合式函数，它提供了一种在每次发出新 HTTP 请求时在服务器端设置数据并在客户端接收数据的机制。通过这种方式，`useHydration` 使您能够完全掌控 hydration 流程。

::note
这是一个高级组合式函数，主要设计用于插件中，被 Nuxt 模块广泛使用。
::

::note
`useHydration` 旨在**在 SSR 期间确保状态同步和恢复**。如果您需要在 Nuxt 中创建适合 SSR 的全局响应式状态，`useState` / [文档链接](/docs/api/组合式函数/use-state) 是推荐的选择。
::

## 使用方式

从服务器 `get` 函数返回的数据会存储在 `nuxtApp.payload` 中，键值为 `useHydration` 的第一个参数所提供的值。在 hydration 过程中，这些数据会在客户端被检索，从而避免重复计算或 API 调用。

::code-group

```ts [With useHydration]
export default defineNuxtPlugin((nuxtApp) => {
  const myStore = new MyStore()

  useHydration(
    'myStoreState',
    () => myStore.getState(),
    data => myStore.setState(data),
  )
})
```

```ts [Without useHydration]
export default defineNuxtPlugin((nuxtApp) => {
  const myStore = new MyStore()

  if (import.meta.server) {
    nuxt.hooks.hook('app:rendered', () => {
      nuxtApp.payload.myStoreState = myStore.getState()
    })
  }

  if (import.meta.client) {
    nuxt.hooks.hook('app:created', () => {
      myStore.setState(nuxtApp.payload.myStoreState)
    })
  }
})
```
::

## 类型

```ts [Signature]
export function useHydration<T> (key: string, get: () => T, set: (value: T) => void): void
```

## 参数

| 参数 | 类型 | 描述 |
| --- | --- | --- |
| `key` | `string` | 用于识别 Nuxt 应用中数据的唯一键。 |
| `get` | `() => T` | 仅在服务器端执行的函数（在 SSR 渲染完成后调用），用于设置初始值。 |
| `set` | `(value: T) => void` | 仅在客户端执行的函数（在初始 Vue 实例创建时调用），用于接收数据。 |

## 返回值

此组合式函数不返回任何值。
