---
title: useRequestFetch
description: 使用组合式函数 useRequestFetch 来传递服务器端获取请求的请求上下文和头部。
minimalVersion: "3.2"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

在进行服务器端获取请求时，可以使用 `useRequestFetch` 来传递请求上下文和头部。

在进行客户端获取请求时，浏览器会自动发送必要的头部信息。
然而，在服务器端渲染过程中进行请求时，出于安全考虑，我们需要手动传递头部信息。

::note
**不打算被传递**的头部信息将**不会**包含在请求中。这些头部信息包括例如：
`transfer-encoding`、`connection`、`keep-alive`、`upgrade`、`expect`、`host`、`accept`
::

::tip
组合式函数 [`useFetch`](/docs/api/组合式函数/use-fetch) 在底层使用 `useRequestFetch` 来自动传递请求上下文和头部信息。
::

::code-group

```vue [app/pages/index.vue]
<script setup lang="ts">
// This will forward the user's headers to the `/api/cookies` event handler
// Result: { cookies: { foo: 'bar' } }
const requestFetch = useRequestFetch()
const { data: forwarded } = await useAsyncData(() => requestFetch('/api/cookies'))

// This will NOT forward anything
// Result: { cookies: {} }
const { data: notForwarded } = await useAsyncData((_nuxtApp, { signal }) => $fetch('/api/cookies', { signal }))
</script>
```

```ts [server/api/cookies.ts]
export default defineEventHandler((event) => {
  const cookies = parseCookies(event)

  return { cookies }
})
```

::

::tip
在浏览器中的客户端导航过程中，`useRequestFetch` 的行为与常规的 [`$fetch`](/docs/api/utils/dollarfetch) 相同。
::
