---
title: useRuntimeConfig
description: 通过组合式函数 useRuntimeConfig 访问运行时配置变量。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/nuxt.ts
    size: xs
---

## 使用方式

```vue [app/app.vue]
<script setup lang="ts">
const config = useRuntimeConfig()
</script>
```

```ts [server/api/foo.ts]
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
})
```

:read-more{to="/docs/guide/going-further/runtime-config"}

## 定义运行时配置

以下示例展示了如何设置公共 API 基础 URL 和仅在服务器上可访问的机密 API 令牌。

我们应该始终在 `nuxt.config` 中定义 `runtimeConfig` 变量。

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  runtimeConfig: {
    // Private keys are only available on the server
    apiSecret: '123',

    // Public keys that are exposed to the client
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
    },
  },
})
```

::note
需要在服务器上可访问的变量直接添加到 `runtimeConfig` 中。需要在客户端和服务器上均可访问的变量则定义在 `runtimeConfig.public` 中。
::

:read-more{to="/docs/guide/going-further/runtime-config"}

## 访问运行时配置

要访问运行时配置，可以使用组合式函数 `useRuntimeConfig()`：

```ts [server/api/test.ts]
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  // Access public variables
  const result = await $fetch(`/test`, {
    baseURL: config.public.apiBase,
    headers: {
      // Access a private variable (only available on the server)
      Authorization: `Bearer ${config.apiSecret}`,
    },
  })
  return result
})
```

在这个示例中，由于 `apiBase` 定义在 `public` 命名空间内，它在服务器和客户端都可以访问，而 `apiSecret**仅在服务器端可访问**。

## 环境变量

可以通过以 `NUXT_` 开头的匹配环境变量名称来更新运行时配置值。

:read-more{to="/docs/guide/going-further/runtime-config"}

### 使用 `.env` 文件

我们可以在 `.env` 文件中设置环境变量，以便在 **开发** 和 **构建/生成** 过程中可访问。

```ini [.env]
NUXT_PUBLIC_API_BASE = "https://api.localhost:5555"
NUXT_API_SECRET = "123"
```

::note
在 **开发** 和 **构建/生成** 过程中，`.env` 文件中设置的任何环境变量都通过 Nuxt 应用中的 `process.env` 访问。
::

::warning
在 **生产运行时**，应使用平台环境变量，而不使用 `.env`。
::

:read-more{to="/docs/directory-structure/env"}

## `app` 命名空间

Nuxt 在运行时配置中使用 `app` 命名空间，键包括 `baseURL` 和 `cdnURL`。你可以通过设置环境变量在运行时自定义这些值。

::note
这是一个保留的命名空间。不应在 `app` 中引入额外的键。
::

### `app.baseURL`

默认情况下，`baseURL` 被设置为 `'/'`。

不过，可以通过设置 `NUXT_APP_BASE_URL` 作为环境变量在运行时更新 `baseURL`。

然后，你可以使用 `config.app.baseURL` 访问这个新的基础 URL。

```ts [/plugins/my-plugin.ts]
export default defineNuxtPlugin((NuxtApp) => {
  const config = useRuntimeConfig()

  // Access baseURL universally
  const baseURL = config.app.baseURL
})
```

### `app.cdnURL`

此示例展示了如何设置自定义 CDN URL 并通过 `useRuntimeConfig()` 访问它们。

你可以使用 `NUXT_APP_CDN_URL` 环境变量在 `.output/public` 中使用自定义 CDN 提供静态资源。

然后，通过 `config.app.cdnURL` 访问新的 CDN URL。

```ts [server/api/foo.ts]
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)

  // Access cdnURL universally
  const cdnURL = config.app.cdnURL
})
```

:read-more{to="/docs/guide/going-further/runtime-config"}
