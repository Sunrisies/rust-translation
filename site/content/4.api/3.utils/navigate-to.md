---
title: navigateTo
description: navigateTo 是一个辅助函数，用于以编程方式引导用户导航。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

## 使用方式

`navigateTo` 既可在服务器端也可在客户端使用。它可以在 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)中调用，也可以直接调用以执行页面导航。

::warning
在调用 `navigateTo` 时，务必在结果上使用 `await` 或 `return`。
::

::note
`navigateTo` 无法在 Nitro 路由中使用。若需在 Nitro 路由中执行服务器端重定向，请使用 [`sendRedirect`](https://h3.dev/utils/response#redirectlocation-status-statustext) 替代。
::

### 在 Vue 组件内使用

```vue
<script setup lang="ts">
// passing 'to' as a string
await navigateTo('/search')

// ... or as a route object
await navigateTo({ path: '/search' })

// ... or as a route object with query parameters
await navigateTo({
  path: '/search',
  query: {
    page: 1,
    sort: 'asc',
  },
})
</script>
```

::note
调用 `navigateTo` 不会停止 `<script setup>` 代码的后续执行。若您希望导航成功后从 `setup()` 中提前返回，请启用 [`experimental.navigateToEarlyReturn`](/docs/guide/going-further/experimental-features#navigatetoearlyreturn)。
::

### 在路由中间件内使用

```ts
export default defineNuxtRouteMiddleware((to, from) => {
  if (to.path !== '/search') {
    // setting the redirect code to '301 Moved Permanently'
    return navigateTo('/search', { redirectCode: 301 })
  }
})
```

当在路由中间件中使用 `navigateTo` 时，必须**返回其结果**，以确保中间件执行流程正常。

例如，以下实现**不会按预期工作**：

```ts
export default defineNuxtRouteMiddleware((to, from) => {
  if (to.path !== '/search') {
    // ❌ This will not work as expected
    navigateTo('/search', { redirectCode: 301 })
    return
  }
})
```

在这种情况下，`navigateTo` 会被执行但不会被返回，这可能导致意外行为。

:read-more{to="/docs/directory-structure/app/middleware"}

### 导航到外部 URL

`navigateTo` 中的 `external` 参数影响对 URL 导航的处理方式：

- **未设置 `external: true`**：
  - 内部 URL 按预期导航。
  - 外部 URL 会抛出错误。

- **设置了 `external: true`**：
  - 内部 URL 会进行全页面重新加载。
  - 外部 URL 按预期导航。

#### 示例

```vue
<script setup lang="ts">
// will throw an error;
// navigating to an external URL is not allowed by default
await navigateTo('https://nuxt.com')

// will redirect successfully with the 'external' parameter set to 'true'
await navigateTo('https://nuxt.com', {
  external: true,
})
</script>
```

### 在新标签页中打开页面

```vue
<script setup lang="ts">
// will open 'https://nuxt.com' in a new tab
await navigateTo('https://nuxt.com', {
  open: {
    target: '_blank',
    windowFeatures: {
      width: 500,
      height: 500,
    },
  },
})
</script>
```

## 类型

```ts [Signature]
export function navigateTo (
  to: RouteLocationRaw | undefined | null,
  options?: NavigateToOptions,
): Promise<void | NavigationFailure | false> | false | void

interface NavigateToOptions {
  replace?: boolean
  redirectCode?: number
  external?: boolean
  open?: OpenOptions
}

type OpenOptions = {
  target: string
  windowFeatures?: OpenWindowFeatures
}

type OpenWindowFeatures = {
  popup?: boolean
  noopener?: boolean
  noreferrer?: boolean
} & XOR<{ width?: number }, { innerWidth?: number }>
  & XOR<{ height?: number }, { innerHeight?: number }>
  & XOR<{ left?: number }, { screenX?: number }>
  & XOR<{ top?: number }, { screenY?: number }>
```

## 参数

### `to`

**类型**: [`RouteLocationRaw`](https://router.vuejs.org/api/interfaces/routelocationoptions) | `undefined` | `null`

**默认值**: `'/'`

`to` 可以是普通字符串或要重定向的路由对象。当传入 `undefined` 或 `null` 时，默认值为 `'/'`。

#### 示例

```ts
// Passing the URL directly will redirect to the '/blog' page
await navigateTo('/blog')

// Using the route object, will redirect to the route with the name 'blog'
await navigateTo({ name: 'blog' })

// Redirects to the 'product' route while passing a parameter (id = 1) using the route object.
await navigateTo({ name: 'product', params: { id: 1 } })
```

### `options`（可选）

**类型**: `NavigateToOptions`

这是一个接受以下属性的对象：

- `replace`

  - **类型**: `boolean`
  - **默认值**: `false`
  - 默认情况下，`navigateTo` 会将给定路由推入客户端的 Vue Router 实例中。

    通过将 `replace` 设置为 `true` 可以更改此行为，表示应替换给定路由。

- `redirectCode`

  - **类型**: `number`
  - **默认值**: `302`

  - `navigateTo` 在服务器端进行重定向时，默认将重定向代码设置为 [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/302)。

    这种默认行为可以通过提供不同的 `redirectCode` 来修改。通常，可以使用 [`301 Moved Permanently`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/301) 进行永久重定向。

- `external`

  - **类型**: `boolean`
  - **默认值**: `false`

  - 当设置为 `true` 时，允许导航到外部 URL。否则，`navigateTo` 将抛出错误，因为默认情况下不允许外部导航。

- `open`

  - **类型**: `OpenOptions`
  - 允许使用窗口的 [open()](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) 方法导航到 URL。此选项仅适用于客户端，在服务器端将被忽略。

    一个接受以下属性的对象：

  - `target`

    - **类型**: `string`
    - **默认值**: `'_blank'`

    - 一个无空格的字符串，指定资源加载到的浏览上下文名称。

  - `windowFeatures`

    - **类型**: `OpenWindowFeatures`

    - 一个接受以下属性的对象：

      | 属性                      | 类型      | 描述                                                                                    |
      |---------------------------|-----------|------------------------------------------------------------------------------------------------|
      | `popup`                   | `boolean` | 请求一个最小的弹出窗口而不是新标签页，UI 特性由浏览器决定。       |
      | `width` 或 `innerWidth`   | `number`  | 指定内容区域的宽度（至少 100 像素），包括滚动条。                 |
      | `height` 或 `innerHeight` | `number`  | 指定内容区域的高度（至少 100 像素），包括滚动条。                |
      | `left` 或 `screenX`       | `number`  | 设置新窗口相对于屏幕左边缘的水平位置。                          |
      | `top` 或 `screenY`        | `number`  | 设置新窗口相对于屏幕上边缘的垂直位置。                           |
      | `noopener`                | `boolean` | 防止新窗口通过 `window.opener` 访问原始窗口。                  |
      | `noreferrer`              | `boolean` | 防止发送 Referer 请求头，并隐式启用 `noopener`。                 |

      有关 **windowFeatures** 属性的详细信息，请参阅 [文档](https://developer.mozilla.org/en-US/docs/Web/API/Window/open#windowfeatures)。
