---
title: preloadComponents
description: Nuxt 提供了一些工具，让你能够控制组件的预加载。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/preload.ts
    size: xs
---

组件预加载是指提前加载页面即将使用的组件，这样你可以在渲染生命周期的早期开始加载这些组件。这能确保它们更早可用，减少干扰页面渲染的可能性，从而提升性能。

使用 `preloadComponents` 可以手动预加载在 Nuxt 应用中全局注册的单个组件。默认情况下，Nuxt 会将这些组件注册为异步组件。你必须使用 Pascal 大小写的组件名称。

```ts
await preloadComponents('MyGlobalComponent')

await preloadComponents(['MyGlobalComponent1', 'MyGlobalComponent2'])
```

::note
在服务器环境下，`preloadComponents` 将不起作用。
::
