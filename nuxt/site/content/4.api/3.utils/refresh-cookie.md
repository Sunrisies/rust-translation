---
title: 刷新 Cookie
description: 当 Cookie 发生变化时，手动刷新 Cookie 值
minimalVersion: "3.10"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/cookie.ts
    size: xs
---

::important
此工具自 [Nuxt v3.10](/blog/v3-10) 起可用。
::

## 目的

`refreshCookie` 函数旨在刷新 `useCookie` 返回的 Cookie 值。

当我们知道浏览器中已设置新的 Cookie 值时，这有助于更新 `useCookie` ref。

## 使用方式

```vue [app/app.vue]
<script setup lang="ts">
const tokenCookie = useCookie('token')

const login = async (username, password) => {
  const token = await $fetch('/api/token', { /** ... */ }) // Sets `token` cookie on response
  refreshCookie('token')
}

const loggedIn = computed(() => !!tokenCookie.value)
</script>
```

::note{to="/docs/guide/going-further/experimental-features#cookiestore"}
自 [Nuxt v3.12.0](https://github.com/nuxt/nuxt/releases/tag/v3.12.0) 起，实验性 `cookieStore` 选项默认启用。当浏览器中的 Cookie 发生变化时，它会自动刷新 `useCookie` 的值。
::

## 类型

```ts [Signature]
export function refreshCookie (name: string): void
```
