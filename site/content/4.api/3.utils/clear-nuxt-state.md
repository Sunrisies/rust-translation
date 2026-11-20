---
title: clearNuxtState
description: 删除 `useState` 的缓存状态。
minimalVersion: "3.6"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/state.ts
    size: xs
---

::note
此方法适用于需要使 `useState` 的状态失效的情况。您也可以通过将 `{ reset: true }` 作为第二个参数来将状态重置为其初始值。
::

## Type

```ts [Signature]
export function clearNuxtState (keys?: string | string[] | ((key: string) => boolean), opts?: ClearNuxtStateOptions): void
```

## Parameters

- `keys`: 一个或多个在 [`useState`](/docs/api/组合式函数/use-state) 中用于删除其缓存状态的键。如果未提供任何键，则**所有状态**将失效。
- `opts`: 用于配置清除行为的选项对象。
  - `reset` :badge[v4.4]{color="info" size="xs" class="align-middle"}: 当设置为 `true` 时，将状态重置为 [`useState`](/docs/api/组合式函数/use-state) 的 `init` 函数提供的初始值，而不是设置为 `undefined`。未指定时，默认值为您 Nuxt 配置中 `experimental.defaults.useState.resetOnClear` 的值（在 `compatibilityVersion: 5` 时该值为 `true`）。
