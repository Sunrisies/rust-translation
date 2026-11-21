---
title: addRouteMiddleware
description: addRouteMiddleware() 是一个辅助函数，用于在应用程序中动态添加中间件。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::note
路由中间件是导航守卫，存储在 Nuxt 应用的 [`app/middleware/`](/docs/directory-structure/app/中间件) 目录中（除非[另有设置](/docs/api/nuxt-config#中间件)）。
::

## 类型

```ts [Signature]
function addRouteMiddleware (name: string, middleware: RouteMiddleware, options?: AddRouteMiddlewareOptions): void
function addRouteMiddleware (middleware: RouteMiddleware): void

interface AddRouteMiddlewareOptions {
  global?: boolean
}
```

## 参数

### `name`

- **类型:** `string` | `RouteMiddleware`

可以是字符串或类型为 `RouteMiddleware` 的函数。函数以下一个路由 `to` 作为第一个参数，当前路由 `from` 作为第二个参数，两者均为 Vue 路由对象。

更多关于[路由对象](/docs/api/组合式函数/use-route)的可用属性，请参考相关文档。

### `middleware`

- **类型:** `RouteMiddleware`

第二个参数是一个类型为 `RouteMiddleware` 的函数。与上面相同，它提供 `to` 和 `from` 路由对象。如果 `addRouteMiddleware()` 的第一个参数已经是函数形式，则此参数变为可选。

### `options`

- **类型:** `AddRouteMiddlewareOptions`

可选的 `options` 参数允许你将 `global` 的值设置为 `true`，以指示路由中间件是全局的还是非全局的（默认值为 `false`）。

## 示例

### 命名路由中间件

命名路由中间件通过提供第一个参数为字符串、第二个参数为函数来定义：

```ts [app/plugins/my-plugin.ts]
export default defineNuxtPlugin(() => {
  addRouteMiddleware('named-middleware', () => {
    console.log('named middleware added in Nuxt plugin')
  })
})
```

当在插件中定义时，它会覆盖 `app/middleware/` 目录中同名的现有中间件。

### 全局路由中间件

全局路由中间件可以通过两种方式定义：

- 直接将函数作为第一个参数传递，不指定名称。它将自动被视为全局中间件，并在每次路由更改时应用。

  ```ts [app/plugins/my-plugin.ts]
  export default defineNuxtPlugin(() => {
    addRouteMiddleware((to, from) => {
      console.log('anonymous global middleware that runs on every route change')
    })
  })
  ```

- 设置可选的第三个参数 `{ global: true }`，以指示路由中间件是全局的。

  ```ts [app/plugins/my-plugin.ts]
  export default defineNuxtPlugin(() => {
    addRouteMiddleware('global-middleware', (to, from) => {
      console.log('global middleware that runs on every route change')
    },
    { global: true },
    )
  })
  ```
