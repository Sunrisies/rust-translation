---
title: createError
description: 创建一个包含额外元数据的错误对象。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

您可以使用此函数创建包含额外元数据的错误对象。该函数在您的应用 Vue 和 Nitro 部分均可用，并且应被抛出。

## 参数

- `err`: `string | { cause, data, message, name, stack, status, statusText, fatal }`

您可以将字符串或对象传递给 `createError` 函数。如果您传递字符串，它将作为错误 `message` 使用，且 `status` 默认为 `500`。如果您传递对象，则可以设置错误的多个属性，如 `status`、`message` 和其他错误属性。

## 在 Vue 应用中

如果您使用 `createError` 创建错误并抛出：

- 在服务器端，它将触发全屏错误页面，您可以通过 `clearError` 清除该页面。
- 在客户端侧，它将抛出一个非致命错误供您处理。如果您需要触发全屏错误页面，可以设置 `fatal: true`。
- on client-side, it will throw a non-fatal error for you to handle. If you need to trigger a full-screen error page, then you can do this by setting `fatal: true`.

### 示例

```vue [app/pages/movies/[slug\\].vue]
<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/movies/${route.params.slug}`)
if (!data.value) {
  throw createError({ status: 404, statusText: 'Page Not Found' })
}
</script>
```

### 错误原因

在创建错误时，您可以传递 `cause` 以保留原始错误：

```ts
try {
  await fetchMovie(route.params.slug)
} catch (cause) {
  throw createError({
    status: 500,
    message: 'Could not load movie',
    cause,
  })
}
```

在开发环境中，原因链通过错误的 `cause` 属性暴露给您的 [错误页面](/docs/getting-started/error-handling#error-page)，并以 `{ name, message, stack, cause }` 的形式序列化（基本类型原因直接传递；其他值被省略）。在生产环境中，原因不会包含在错误响应或错误页面载荷中。

## 在 API 路由中

使用 `createError` 在服务器 API 路由中触发错误处理。

### 示例

```ts [server/api/error.ts]
export default eventHandler(() => {
  throw createError({
    status: 404,
    statusText: 'Page Not Found',
  })
})
```

在 API 路由中，建议使用 `createError` 并传递包含简短 `statusText` 的对象，因为该信息可以在客户端访问。否则，在 API 路由中传递给 `createError` 的 `message` 不会传播到客户端。或者，您可以使用 `data` 属性将数据返回给客户端。当使用 `useFetch` 处理错误时，自定义数据可在 `error.value.data.data` 处获取。无论如何，始终避免将动态用户输入放入消息中，以防止潜在的安全问题。

:read-more{to="/docs/getting-started/error-handling"}
