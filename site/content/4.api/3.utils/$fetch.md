---
title: $fetch
description: Nuxt 使用 $fetch 来全局暴露用于执行 HTTP 请求的辅助函数。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/entry.ts
    size: xs
---

Nuxt 使用 [ofetch](https://github.com/unjs/ofetch) 来全局暴露用于在 Vue 应用或 API 路由中执行 HTTP 请求的 `$fetch` 辅助函数。

::tip{icon="i-lucide-rocket"}
在服务器端渲染过程中，调用 $fetch 来获取内部 [API 路由](/docs/directory-structure/server) 会直接调用相关函数（模拟请求），从而**避免额外的 API 调用**。
::

::note{color="blue" icon="i-lucide-info"}
在组件中使用 $fetch 而不使用 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 包裹，会导致数据被获取两次：第一次在服务器端，第二次在客户端 hydration 时，因为 $fetch 不会将状态从服务器传输到客户端。因此，由于客户端需要再次获取数据，请求会在两端执行。
::

## 使用方式

我们建议在使用组合式函数获取组件数据时，使用 [`useFetch`](/docs/api/组合式函数/use-fetch) 或 [`useAsyncData`](/docs/api/组合式函数/use-async-data) + $fetch，以避免重复获取数据。

```vue [app/app.vue]
<script setup lang="ts">
// During SSR data is fetched twice, once on the server and once on the client.
const dataTwice = await $fetch('/api/item')

// During SSR data is fetched only on the server side and transferred to the client.
const { data } = await useAsyncData('item', () => $fetch('/api/item'))

// You can also useFetch as shortcut of useAsyncData + $fetch
const { data } = await useFetch('/api/item')
</script>
```

:read-more{to="/docs/getting-started/data-fetching"}

你可以在所有仅在客户端执行的方法中使用 $fetch。

```vue [app/pages/contact.vue]
<script setup lang="ts">
async function contactForm () {
  await $fetch('/api/contact', {
    method: 'POST',
    body: { hello: 'world' },
  })
}
</script>

<template>
  <button @click="contactForm">
    Contact
  </button>
</template>
```

::tip
在 Nuxt 中，使用 $fetch 进行 HTTP 调用是更优的方式，而不是为 Nuxt 2 设计的 [@nuxt/http](https://github.com/nuxt/http) 和 [@nuxtjs/axios](https://github.com/nuxt-community/axios-module)。
::

::note
如果在开发过程中使用 $fetch 调用带有自签名证书的 (外部) HTTPS URL，您需要在环境中设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`。
::

### 传递头部和 Cookie

当我们在浏览器中调用 $fetch 时，用户头部如 `cookie` 会直接发送到 API。

然而，在服务器端渲染过程中，由于 **服务器端请求伪造 (SSRF)** 或 **认证滥用** 等安全风险，$fetch 不会包含用户的浏览器 Cookie，也不会在获取响应中传递 Cookie。

::code-group

```vue [app/pages/index.vue]
<script setup lang="ts">
// This will NOT forward headers or cookies during SSR
const { data } = await useAsyncData(() => $fetch('/api/cookies'))
</script>
```

```ts [server/api/cookies.ts]
export default defineEventHandler((event) => {
  const foo = getCookie(event, 'foo')
  // ... Do something with the cookie
})
```
::

如果您需要在服务器上转发头部和 Cookie，必须手动传递它们：

```vue [app/pages/index.vue]
<script setup lang="ts">
// This will forward the user's headers and cookies to `/api/cookies`
const requestFetch = useRequestFetch()
const { data } = await useAsyncData(() => requestFetch('/api/cookies'))
</script>
```

然而，当在服务器上调用 `useFetch` 时使用相对 URL，Nuxt 将使用 [`useRequestFetch`](/docs/api/组合式函数/use-request-fetch) 来代理头部和 Cookie（除了不应被转发到的头部，如 `host`）。
