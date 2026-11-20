---
title: useRouter
description: 组合式函数 useRouter 返回路由实例。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

```vue [app/pages/index.vue]
<script setup lang="ts">
const router = useRouter()
</script>
```

如果您仅在模板中需要路由实例，请使用 `$router`：

```vue [app/pages/index.vue]
<template>
  <button @click="$router.back()">
    Back
  </button>
</template>
```

如果您有 `app/pages/` 目录，`useRouter` 的行为与 `vue-router` 提供的功能相同。

::read-more{icon="i-simple-icons-vuedotjs" to="https://router.vuejs.org/api/interfaces/router#Properties-currentRoute-" target="_blank"}
查阅 `vue-router` 文档中的 `Router` 接口说明。
::

## 基本操作

- [`addRoute()`](https://router.vuejs.org/api/interfaces/router#addRoute-)：将新路由添加到路由实例中。`parentName` 可用于将新路由作为现有路由的子路由添加。
- [`removeRoute()`](https://router.vuejs.org/api/interfaces/router#removeRoute-)：按名称移除现有路由。
- [`getRoutes()`](https://router.vuejs.org/api/interfaces/router#getRoutes-)：获取所有路由记录的完整列表。
- [`hasRoute()`](https://router.vuejs.org/api/interfaces/router#hasRoute-)：检查是否存在给定名称的路由。
- [`resolve()`](https://router.vuejs.org/api/interfaces/router#resolve-)：返回路由位置的规范化版本。还包含 `href` 属性，其中包含任何现有的基础路径。

```ts [Example]
const router = useRouter()

router.addRoute({ name: 'home', path: '/home', component: Home })
router.removeRoute('home')
router.getRoutes()
router.hasRoute('home')
router.resolve({ name: 'home' })
```

::note
`router.addRoute()` 将路由详情添加到路由数组中，在构建 [Nuxt 插件](/docs/directory-structure/app/plugins) 时非常有用；而 `router.push()` 则立即触发新的导航，在页面、Vue 组件和组合式函数中很有用。
::

## 基于历史 API

- [`back()`](https://router.vuejs.org/api/interfaces/router#back-)：如果可能，返回到历史记录中的上一个位置，与 `router.go(-1)` 相同。
- [`forward()`](https://router.vuejs.org/api/interfaces/router#forward-)：如果可能，前进到历史记录中的下一个位置，与 `router.go(1)` 相同。
- [`go()`](https://router.vuejs.org/api/interfaces/router#go-)：在不受 `router.back()` 和 `router.forward()` 所施加的层级限制下，向前或向后移动历史记录。
- [`push()`](https://router.vuejs.org/api/interfaces/router#push-)：通过向历史栈中添加条目来程序化地导航到新 URL。**建议使用 [`navigateTo`](/docs/api/utils/navigate-to) 代替。**
- [`replace()`](https://router.vuejs.org/api/interfaces/router#replace-)：通过替换路由历史栈中的当前条目来程序化地导航到新 URL。**建议使用 [`navigateTo`](/docs/api/utils/navigate-to) 代替。**

```ts [Example]
const router = useRouter()

router.back()
router.forward()
router.go(3)
router.push({ path: '/home' })
router.replace({ hash: '#bio' })
```

::read-more{icon="i-simple-icons-mdnwebdocs" to="https://developer.mozilla.org/en-US/docs/Web/API/History" target="_blank"}
了解更多关于浏览器 History API 的信息。
::

## 导航守卫

`useRouter` 组合式函数提供了 `afterEach`、`beforeEach` 和 `beforeResolve` 辅助方法，这些方法可作为导航守卫使用。

不过，Nuxt 拥有 **路由中间件** 的概念，这简化了导航守卫的实现，并提升了开发体验。

:read-more{to="/docs/directory-structure/app/middleware"}

## Promise 和错误处理

- [`isReady()`](https://router.vuejs.org/api/interfaces/router#isReady-): 返回一个 Promise，当路由器完成初始导航时该 Promise 将被解析。
- [`onError`](https://router.vuejs.org/api/interfaces/router#onError-): 添加一个错误处理器，在导航过程中发生未捕获错误时调用该处理器。

:read-more{icon="i-simple-icons-vuedotjs" to="https://router.vuejs.org/api/interfaces/router#Methods-" title="Vue Router 文档" target="_blank"}

## 通用路由器实例

如果您没有 `app/pages/` 文件夹，`useRouter` 将返回一个具有类似辅助方法的通用路由器实例，但请注意，并非所有功能都受支持，且行为可能与 `vue-router` 有所不同。
