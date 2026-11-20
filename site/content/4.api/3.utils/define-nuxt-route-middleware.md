---
title: defineNuxtRouteMiddleware
description: 使用 defineNuxtRouteMiddleware 辅助函数创建具有名称的路由中间件。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

路由中间件存储在 Nuxt 应用的 [`app/middleware/`](/docs/directory-structure/app/中间件) 中（除非[另有设置](/docs/api/nuxt-config#中间件)）。

## 类型

```ts [Signature]
export function defineNuxtRouteMiddleware (middleware: RouteMiddleware): RouteMiddleware

interface RouteMiddleware {
  (to: RouteLocationNormalized, from: RouteLocationNormalized): ReturnType<NavigationGuard>
}
```

## 参数

### `middleware`

- **类型**: `RouteMiddleware`

一个接受两个 Vue Router 的路由位置对象作为参数的函数：第一个为下一个路由 `to`，第二个为当前路由 `from`。

关于 `RouteLocationNormalized` 的可用属性，请参考**[Vue Router 文档](https://router.vuejs.org/api/type-aliases/routelocationnormalized)**。

## 示例

### 显示错误页面

你可以使用路由中间件来抛出错误并显示有用的错误信息：

```ts [app/middleware/error.ts]
export default defineNuxtRouteMiddleware((to) => {
  if (to.params.id === '1') {
    throw createError({ status: 404, statusText: 'Page Not Found' })
  }
})
```

上述路由中间件会将用户重定向到 `~/error.vue` 文件中定义的自定义错误页面，并展示从中间件传递的错误消息和代码。

### 重定向

在路由中间件中结合使用 [`useState`](/docs/api/组合式函数/use-state) 和 `navigateTo` 辅助函数，可以根据用户的认证状态将用户重定向到不同的路由：

```ts [app/middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useState('auth')

  if (!auth.value.isAuthenticated) {
    return navigateTo('/login')
  }

  if (to.path !== '/dashboard') {
    return navigateTo('/dashboard')
  }
})
```

[navigateTo](/docs/api/utils/navigate-to) 和 [abortNavigation](/docs/api/utils/abort-navigation) 都是全局可用的辅助函数，你可以在 `defineNuxtRouteMiddleware` 中直接使用。
