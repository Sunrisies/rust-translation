---
title: abortNavigation
description: abortNavigation 是一个辅助函数，用于阻止导航操作，并将参数设为 true 时抛出错误。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::warning
`abortNavigation` 仅可在 [路由中间件处理器](/docs/directory-structure/app/中间件) 中使用。
::

## 类型

```ts [Signature]
export function abortNavigation (err?: Error | string): false
```

## 参数

### `err`

- **类型**: [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) | `string`

  由 `abortNavigation` 抛出的可选错误。

## 示例

以下示例展示了如何在路由中间件中使用 `abortNavigation` 来阻止未经授权的路由访问：

```ts [app/middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useState('user')

  if (!user.value.isAuthorized) {
    return abortNavigation()
  }

  if (to.path !== '/edit-post') {
    return navigateTo('/edit-post')
  }
})
```

### `err` 作为字符串

你可以将错误作为字符串传递：

```ts [app/middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useState('user')

  if (!user.value.isAuthorized) {
    return abortNavigation('Insufficient permissions.')
  }
})
```

### `err` 作为 `Error` 对象

你可以将错误作为 [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) 对象传递，例如由 `catch` 块捕获：

```ts [app/middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  try {
    /* code that might throw an error */
  } catch (err) {
    return abortNavigation(err)
  }
})
```
