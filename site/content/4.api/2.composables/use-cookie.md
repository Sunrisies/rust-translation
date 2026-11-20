---
title: 使用 useCookie
description: useCookie 是一个适合 SSR 环境的组合式函数，用于读取和写入 Cookie。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/cookie.ts
    size: xs
---

## 使用方式

在您的页面、组件和插件中，可以使用 `useCookie` 以适合 SSR 的方式读取和写入 Cookie。

```ts [Usage]
const cookie = useCookie(name, options)
```

::note
`useCookie` 仅在 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)中生效。
::

::tip
返回的 ref 会自动将 Cookie 值序列化和反序列化为 JSON。
::

## 类型

```ts [Signature]
import type { Ref } from 'vue'
import type { CookieParseOptions, CookieSerializeOptions } from 'cookie-es'

export interface CookieOptions<T = any> extends Omit<CookieSerializeOptions & CookieParseOptions, 'decode' | 'encode'> {
  decode?(value: string): T
  encode?(value: T): string
  default?: () => T | Ref<T>
  watch?: boolean | 'shallow'
  readonly?: boolean
  refresh?: boolean
}

export interface CookieRef<T> extends Ref<T> {}

export function useCookie<T = string | null | undefined> (
  name: string,
  options?: CookieOptions<T>,
): CookieRef<T>
```

## 参数

`name`: Cookie 的名称。

`options`: 用于控制 Cookie 行为的选项。该对象可以包含以下属性：

大多数选项将直接传递给 [cookie](https://github.com/jshttp/cookie) 包。

| 属性      | 类型                   | 默认值        | 描述                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
|---------------|------------------------|----------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `decode`      | `(value: string) => T` | `decodeURIComponent` + [destr](https://github.com/unjs/destr). | 用于解码 Cookie 值的自定义函数。由于 Cookie 的值具有有限的字符集（且必须是简单字符串），此函数可用于将先前编码的 Cookie 值解码为 JavaScript 字符串或其他对象。 <br/> **注意：** 如果此函数抛出错误，则原始未解码的 Cookie 值将作为 Cookie 的值被返回。                                                                                                                                                                                                                                                       |
| `encode`      | `(value: T) => string` | `JSON.stringify` + `encodeURIComponent`                        | 用于编码 Cookie 值的自定义函数。由于 Cookie 的值具有有限的字符集（且必须是简单字符串），此函数可用于将值编码为适合作为 Cookie 值的字符串。                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `default`     | `() => T \| Ref<T>`    | `undefined`                                                    | 如果 Cookie 不存在，则返回默认值的函数。该函数也可以返回 `Ref`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `watch`       | `boolean \| 'shallow'` | `true`                                                         | 是否监听变化并更新 Cookie。`true` 表示深度监听，`'shallow'` 表示浅层监听，即仅监听顶层属性的变化，`false` 表示禁用。<br/> **注意：** 当 Cookie 发生变化时，可以通过 [`refreshCookie`](/docs/api/utils/refresh-cookie) 手动刷新 `useCookie` 的值。                                                                                                                                                                                                                                                                                                                           |
| `refresh` :badge[v4.4]{color="info" size="xs" class="align-middle"} | `boolean`              | `false`                                                        | 如果为 `true`，则每次显式写入时（例如 `cookie.value = cookie.value`）都会刷新 Cookie 的过期时间，即使值本身没有变化。注意：过期时间不会自动刷新，必须通过赋值给 `.value` 来触发刷新。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `readonly`    | `boolean`              | `false`                                                        | 如果为 `true`，则禁止在服务器和客户端对 Cookie 进行写入。组合式函数会返回 `default` 值，但不会保存到浏览器中。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `maxAge`      | `number`               | `undefined`                                                    | Cookie 的最大过期时间，即 [`Max-Age` `Set-Cookie` 属性](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.2) 的值。给定的数字将向下取整为整数。默认情况下不设置最大过期时间。                                                                                                                                                                                                                                                                                                                                                                                   |
| `expires`     | `Date \| (() => Date \| undefined)` | `undefined`                                                    | Cookie 的过期日期，或返回一个获取器。当提供函数时，每次写入 Cookie 时都会执行该函数，因此当值被重新设置时可以更新过期时间。返回 `undefined` 会创建会话 Cookie。获取器应是无副作用的（无副作用）。默认情况下不设置过期时间。大多数客户端将此视为“非持久性 Cookie”，并在退出网页浏览器应用程序等条件下将其删除。<br/> **注意：** [Cookie 存储模型规范](https://datatracker.ietf.org/doc/html/rfc6265#section-5.3) 规定，如果同时设置了 `expires` 和 `maxAge`，则 `maxAge` 具有优先权，但并非所有客户端都遵循此规则，因此如果同时设置，它们应指向同一日期和时间！<br/>如果既不设置 `expires` 也不设置 `maxAge`，则该 Cookie 仅属于会话范围，用户关闭浏览器后将被删除。 |
| `httpOnly`    | `boolean`              | `false`                                                        | 设置 `HttpOnly` 属性。<br/>**注意：** 将此值设置为 `true` 时要小心，因为符合规范的客户端不会允许客户端 JavaScript 在 `document.cookie` 中查看该 Cookie。                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `secure`      | `boolean`              | `false`                                                        | 设置 [`Secure` `Set-Cookie` 属性](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.5)。<br/>**注意：** 将此值设置为 `true` 时要小心，因为如果浏览器没有 HTTPS 连接，符合规范的客户端将来不会将 Cookie发送回服务器。这可能导致水合错误。                                                                                                                                                                                                                                                                                                                |
| `partitioned` | `boolean`              | `false`                                                        | 设置 [`Partitioned` `Set-Cookie` 属性](https://datatracker.ietf.org/doc/html/draft-cutler-httpbis-partitioned-cookies#section-2.1)。<br/>**注意：** 这是一个尚未完全标准化的属性，未来可能会发生变化。<br/>这也意味着许多客户端在理解该属性之前可能会忽略它。<br/>更多信息可以在 [提案](https://github.com/privacycg/CHIPS) 中找到。                                                                                                                                                                                                            |
| `domain`      | `string`               | `undefined`                                                    | 设置 [`Domain` `Set-Cookie` 属性](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.3)。默认情况下不设置域，大多数客户端会认为该 Cookie仅适用于当前域。                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `path`        | `string`               | `'/'`                                                          | 设置 [`Path` `Set-Cookie` 属性](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.4)。默认情况下，路径被视为["默认路径"](https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4)。                                                                                                                                                                                                                                                                                                                                                                                                                       }
| `sameSite`    | `boolean \| string`    | `undefined`                                                    | 设置 [`SameSite` `Set-Cookie` 属性](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7)。<br/>- `true` 将 `SameSite` 属性设置为 `Strict`，以实现严格的跨站限制。<br/>- `false` 不会设置 `SameSite` 属性。<br/>- `'lax'` 将 `SameSite` 属性设置为 `Lax`，以实现宽松的跨站限制。<br/>- `'none'` 将 `SameSite` 属性设置为 `None`，用于显式的跨站 Cookie。<br/>- `'strict'` 将 `SameSite` 属性设置为 `Strict`，以实现严格的跨站限制。                                                                    |

## 返回值

返回一个 Vue `Ref<T>` 对象，代表 Cookie 的值。更新该 ref 将更新 Cookie（除非设置了 `readonly`）。该 ref 适合 SSR 环境，可在客户端和服务器上使用。

## 示例

### 基本用法

下面的示例会创建一个名为 `counter` 的 Cookie。如果 Cookie 不存在，则初始设置为随机值。每当更新 `counter` 变量时，Cookie 也会相应更新。

```vue [app/app.vue]
<script setup lang="ts">
const counter = useCookie('counter')

counter.value ||= Math.round(Math.random() * 1000)
</script>

<template>
  <div>
    <h1>Counter: {{ counter || '-' }}</h1>
    <button @click="counter = null">
      reset
    </button>
    <button @click="counter--">
      -
    </button>
    <button @click="counter++">
      +
    </button>
  </div>
</template>
```

### 只读 Cookie

```vue [app/app.vue]
<script setup lang="ts">
const user = useCookie(
  'userInfo',
  {
    default: () => ({ score: -1 }),
    watch: false,
  },
)

if (user.value) {
  // the actual `userInfo` cookie will not be updated
  user.value.score++
}
</script>

<template>
  <div>User score: {{ user?.score }}</div>
</template>
```

### 可写 Cookie

```vue [app/app.vue]
<script setup lang="ts">
const list = useCookie(
  'list',
  {
    default: () => [],
    watch: 'shallow',
  },
)

function add () {
  list.value?.push(Math.round(Math.random() * 1000))
  // list cookie won't be updated with this change
}

function save () {
  // the actual `list` cookie will be updated
  list.value &&= [...list.value]
}
</script>

<template>
  <div>
    <h1>List</h1>
    <pre>{{ list }}</pre>
    <button @click="add">
      Add
    </button>
    <button @click="save">
      Save
    </button>
  </div>
</template>
```

### Cookie 刷新

```vue [app/app.vue]
<script setup lang="ts">
const session = useCookie(
  'session', {
    maxAge: 60 * 60, // 1 hour
    refresh: true,
    default: () => 'active',
  })

// Even if the value does not change,
// the cookie expiration will be refreshed
// every time the setter is called
session.value = 'active'
</script>

<template>
  <div>Session: {{ session }}</div>
</template>
```

### 使用 Getter 实现动态过期时间

当希望在每次写入 Cookie 时都获得新的过期日期（例如滑动会话或令牌）时，可以使用函数来处理 `expires` 属性。

```vue
<script setup lang="ts">
const token = useCookie('token', {
  // Re-evaluated on every write: keep this getter pure
  expires: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
})

// Assigning a new value also refreshes the cookie expiration
token.value = 'new-token'
</script>
```

### API 路由中的 Cookie

您可以使用 [`h3`](https://github.com/h3js/h3) 包中的 `getCookie` 和 `setCookie` 函数在服务器 API 路由中设置 Cookie。

```ts [server/api/counter.ts]
export default defineEventHandler((event) => {
  // Read counter cookie
  let counter = getCookie(event, 'counter') || 0

  // Increase counter cookie by 1
  setCookie(event, 'counter', ++counter)

  // Send JSON response
  return { counter }
})
```

:link-example{to="/docs/examples/advanced/use-cookie"}
