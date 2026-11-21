---
title: prefetchComponents
description: Nuxt 提供了一些工具，让你能够控制组合式函数的预加载。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/preload.ts
    size: xs
---


组合式函数的预加载是在后台下载代码，其前提是该组件很可能被用于渲染，从而在用户请求时让组件能够立即加载。组件会被下载并缓存起来以备将来使用，而无需用户主动请求。

使用 `prefetchComponents` 可以手动预加载在 Nuxt 应用中全局注册的各个组合式函数。默认情况下，Nuxt 会将这些函数注册为异步组件。你必须使用组件名称的大写 Pascal 格式。

```ts
await prefetchComponents('MyGlobalComponent')

await prefetchComponents(['MyGlobalComponent1', 'MyGlobalComponent2'])
```

::note
当前实现与 [`preloadComponents`](/docs/api/utils/preload-components) 的行为完全相同，只是通过预加载组件而非仅进行预加载来工作，我们正在努力改进这一行为。
::

::note
在服务器上，`prefetchComponents` 将不会产生任何效果。
::
