---
title: callOnce
description: 在 SSR 或 CSR 期间仅执行一次给定的函数或代码块。
minimalVersion: "3.9"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/once.ts
    size: xs
---

::important
此工具自 [Nuxt v3.9](/blog/v3-9) 起可用。
::

## 用途

`callOnce` 函数旨在在以下情况下仅执行一次给定的函数或代码块：
- 服务器端渲染但非 hydration 阶段
- 客户端导航阶段

这对于需要仅执行一次的代码非常有用，例如记录事件或设置全局状态。

## 使用方式

`callOnce` 的默认模式是仅执行一次代码。例如，如果代码在服务器上运行，则不会在客户端再次运行。如果你在客户端多次调用 `callOnce`，例如通过返回到该页面，也不会再次运行。

```vue [app/app.vue]
<script setup lang="ts">
const websiteConfig = useState('config')

await callOnce(async () => {
  console.log('This will only be logged once')
  websiteConfig.value = await $fetch('https://my-cms.com/api/website-config')
})
</script>
```

也可以在每个导航时运行，同时避免初始的服务器/客户端双重执行。为此，可以使用 `navigation` 模式 :badge[v3.15]{color="info" size="xs" class="align-middle"}:

```vue [app/app.vue]
<script setup lang="ts">
const websiteConfig = useState('config')

await callOnce(async () => {
  console.log('This will only be logged once and then on every client side navigation')
  websiteConfig.value = await $fetch('https://my-cms.com/api/website-config')
}, { mode: 'navigation' })
</script>
```

::important
`navigation` 模式自 [Nuxt v3.15](/blog/v3-15) 起可用。
::

::tip{to="/docs/getting-started/state-management#usage-with-pinia"}
`callOnce` 与 [Pinia 模块](/modules/pinia) 结合使用，可用于调用 store 操作。
::

:read-more{to="/docs/getting-started/state-management"}

::warning
请注意，`callOnce` 不返回任何值。如果你希望在 SSR 期间获取数据，应使用 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 或 [`useFetch`](/docs/api/组合式函数/use-fetch)。
::

::note
`callOnce` 是一个组合式函数，可以直接在 setup 函数、插件或路由中间件中调用，因为它需要将数据添加到 Nuxt 负载中，以避免在页面 hydration 时在客户端重新调用该函数。
::

## 类型

```ts [Signature]
export function callOnce (key?: string, fn?: (() => any | Promise<any>), options?: CallOnceOptions): Promise<void>
export function callOnce (fn?: (() => any | Promise<any>), options?: CallOnceOptions): Promise<void>

type CallOnceOptions = {
  /**
   * Execution mode for the callOnce function
   * @default 'render'
   */
  mode?: 'navigation' | 'render'
}
```

## 参数

- `key`: 一个唯一的键，确保代码只运行一次。如果你不提供键，则系统会为 `callOnce` 的实例生成一个与文件和行号唯一的键。
- `fn`: 要一次执行的函数。它可以是异步的。
- `options`: 设置模式，要么在导航时重新执行 (`navigation`)，要么在整个应用生命周期内只执行一次 (`render`)。默认值为 `render`。
  - `render`: 在初始渲染期间（无论是 SSR 还是 CSR）执行一次 - 默认模式
  - `navigation`: 在初始渲染期间以及每次后续客户端导航时执行一次
