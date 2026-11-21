---
title: onNuxtReady
description: onNuxtReady 组合式函数允许在应用初始化完成后执行回调函数。
minimalVersion: "3.1"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ready.ts
    size: xs
---

::important
`onNuxtReady` 仅在客户端侧运行。 :br
它非常适合用于执行不会阻塞应用初始渲染的代码。
::

```ts [app/plugins/ready.client.ts]
export default defineNuxtPlugin(() => {
  onNuxtReady(async () => {
    const myAnalyticsLibrary = await import('my-big-analytics-library')
    // do something with myAnalyticsLibrary
  })
})
```

即使在应用已初始化之后运行也是“安全”的。在这种情况下，该代码将被注册以在下一个空闲回调中执行。
