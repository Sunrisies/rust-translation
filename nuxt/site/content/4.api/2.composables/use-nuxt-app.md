---
title: useNuxtApp
description: 访问 Nuxt 应用的共享运行时上下文。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/nuxt.ts
    size: xs
---

`useNuxtApp` 是一个内置组合式函数，提供了一种访问 Nuxt 共享运行时上下文的方法，该上下文也被称为 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)，在客户端和服务器侧都可用（但不在 Nitro 路由内）。它帮助你访问 Vue 应用实例、运行时钩子、运行时配置变量和内部状态，例如 `ssrContext` 和 `payload`。

```vue [app/app.vue]
<script setup lang="ts">
const nuxtApp = useNuxtApp()
</script>
```

如果当前作用域无法获取运行时上下文，`useNuxtApp` 在调用时会抛出异常。对于不需要 `nuxtApp` 的组合式函数，你可以使用 [`tryUseNuxtApp`](/docs/api/组合式函数/use-nuxt-app#tryusenuxtapp) 来替代，或者简单地检查上下文是否可用而避免异常。

<!--
注意
默认情况下，Nuxt 的共享运行时上下文位于 [`buildId`](/docs/api/nuxt-config#buildid) 选项下，具有命名空间特性。这允许支持多个运行时上下文。

## 参数

- `appName`: 可选的应用名称。如果你不提供，则使用 Nuxt `buildId` 选项；否则必须与现有的 `buildId` 匹配。 -->

## 方法

### `provide (name, value)`

`nuxtApp` 是一个运行时上下文，你可以通过 [Nuxt 插件](/docs/directory-structure/app/plugins) 来扩展它。使用 `provide` 函数创建 Nuxt 插件，使值和辅助方法在所有的组合式函数和组件中可用。

`provide` 函数接受 `name` 和 `value` 参数。

```ts [app/plugins/hello.ts]
const nuxtApp = useNuxtApp()
nuxtApp.provide('hello', name => `Hello ${name}!`)

// Prints "Hello name!"
console.log(nuxtApp.$hello('name'))
```

如上面的示例所示，`$hello` 已成为 `nuxtApp` 上下文的新自定义部分，并且在所有 `nuxtApp` 可访问的地方都可用。

### `hook(name, cb)`

`nuxtApp` 中可用的钩子允许你自定义 Nuxt 应用的运行时特性。你可以在 Vue.js 组合式函数和 [Nuxt 插件](/docs/directory-structure/app/plugins) 中使用运行时钩子来接入渲染生命周期。

`hook` 函数适用于在特定点接入渲染生命周期时添加自定义逻辑。`hook` 函数主要用于创建 Nuxt 插件时。

有关 Nuxt 调用的可用运行时钩子，请参阅 [运行时钩子](/docs/api/advanced/hooks#app-hooks-runtime)。

```ts [app/plugins/test.ts]
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('page:start', () => {
    /* your code goes here */
  })
  nuxtApp.hook('vue:error', (..._args) => {
    console.log('vue:error')
    // if (import.meta.client) {
    //   console.log(..._args)
    // }
  })
})
```

### `callHook(name, ...args)`

当使用任何现有的钩子调用 `callHook` 时，它会返回一个承诺。

```ts [app/plugins/my-plugin.ts]
await nuxtApp.callHook('my-plugin:init')
```

## 属性

`useNuxtApp()` 暴露了以下属性，您可以使用这些属性来扩展和自定义应用，并共享状态、数据和变量。

### `vueApp`

`vueApp` 是全局 Vue.js [应用实例](https://vuejs.org/api/application#application-api)，您可以通过 `nuxtApp` 访问它。

一些有用的方法：
- [`component()`](https://vuejs.org/api/application#app-component) - 如果同时提供名称字符串和组件定义，则注册一个全局组件；如果仅提供名称，则检索已注册的组件。
- [`directive()`](https://vuejs.org/api/application#app-directive) - 如果同时提供名称字符串和指令定义，则注册一个全局自定义指令；如果仅提供名称，则检索已注册的指令[(示例)](/docs/directory-structure/app/plugins#vue-directives)。
- [`use()`](https://vuejs.org/api/application#app-use) - 安装 **[Vue.js 插件](https://vuejs.org/guide/reusability/plugins)** [(示例)](/docs/directory-structure/app/plugins#vue-plugins)。

:read-more{icon="i-simple-icons-vuedotjs" to="https://vuejs.org/api/application.html#application-api"}

### `ssrContext`

`ssrContext` 是在服务器端渲染过程中生成的，仅在服务器侧可用。

Nuxt 通过 `ssrContext` 暴露以下属性：
- `url` (字符串) - 当前请求的 URL。
- `event` ([h3js/h3](https://github.com/h3js/h3) 请求事件) - 访问当前路由的请求和响应。
- `payload` (对象) - NuxtApp 的 payload 对象。

### `payload`

`payload` 将服务器端的数据和状态变量暴露给客户端。以下键在从服务器侧传递后将在客户端可用：

- `serverRendered` (布尔值) - 表示响应是否由服务器端渲染。
- `data` (对象) - 当您使用 [`useFetch`](/docs/api/组合式函数/use-fetch) 或 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 从 API 端点获取数据时，结果 payload 可以从 `payload.data` 访问。此数据被缓存，有助于防止在多次请求相同数据时重复获取。

  ::code-group
  ```vue [app/app.vue]
  <script setup lang="ts">
  const { data } = await useAsyncData('count', (_nuxtApp, { signal }) => $fetch('/api/count', { signal }))
  </script>
  ```
  ```ts [server/api/count.ts]
  export default defineEventHandler((event) => {
    return { count: 1 }
  })
  ```
  ::

  在上面的示例中，使用 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 获取 `count` 的值后，如果您访问 `payload.data`，将会看到 `{ count: 1 }` 记录在那里。

  当从 [`ssrcontext`](/docs/api/组合式函数/use-nuxt-app#ssrcontext) 访问相同的 `payload.data` 时，也可以在服务器端访问相同的值。

- `state` (对象) - 当您在 Nuxt 中使用 [`useState`](/docs/api/组合式函数/use-state) 组合式函数设置共享状态时，此状态数据可通过 `payload.state.[name-of-your-state]` 访问。

  ```ts [app/plugins/my-plugin.ts]
  export const useColor = () => useState<string>('color', () => 'pink')

  export default defineNuxtPlugin((nuxtApp) => {
    if (import.meta.server) {
      const color = useColor()
    }
  })
  ```

  还可以使用更高级的类型，如 `ref`、`reactive`、`shallowRef`、`shallowReactive` 和 `NuxtError`。

#### 自定义reducer/reviver :badge[v3.4]{color="info" size="xs" class="align-middle"}

  自 [Nuxt v3.4](https://nuxt.com/blog/v3-4#payload-enhancements) 起，您可以定义自己的 reducer/reviver 用于 Nuxt 不支持的类型。

  :video-accordion{title="Watch a video from Alexander Lichter about serializing payloads, especially with regards to classes" videoId="8w6ffRBs8a4"}

  在下面的示例中，我们使用 payload 插件为 [Luxon](https://moment.github.io/luxon/#/) DateTime 类定义了一个 reducer（或 serializer）和一个 reviver（或 deserializer）。

  ```ts [app/plugins/date-time-payload.ts]
  /**
   * This kind of plugin runs very early in the Nuxt lifecycle, before we revive the payload.
   * You will not have access to the router or other Nuxt-injected properties.
   *
   * Note that the "DateTime" string is the type identifier and must
   * be the same on both the reducer and the reviver.
   */
  export default definePayloadPlugin((nuxtApp) => {
    definePayloadReducer('DateTime', (value) => {
      return value instanceof DateTime && value.toJSON()
    })
    definePayloadReviver('DateTime', (value) => {
      return DateTime.fromISO(value)
    })
  })
  ```

### `isHydrating`

使用 `nuxtApp.isHydrating` (布尔值) 来检查 Nuxt 应用是否在客户端进行 hydration 操作。

```ts [app/components/nuxt-error-boundary.ts]
export default defineComponent({
  setup (_props, { slots, emit }) {
    const nuxtApp = useNuxtApp()
    onErrorCaptured((err) => {
      if (import.meta.client && !nuxtApp.isHydrating) {
        // ...
      }
    })
  },
})
```

### `runWithContext`

::note
您出现在这里很可能是因为收到了“Nuxt instance unavailable”消息。请谨慎使用此方法，并报告导致问题的示例，以便最终在框架层面得到解决。
::

`runWithContext` 方法用于调用函数并明确提供 Nuxt 上下文。通常，Nuxt 上下文是隐式传递的，您无需担心这一点。然而，在中间件/插件中处理复杂的 `async`/`await` 场景时，可能会遇到当前实例在异步调用后被取消的情况。

```ts [app/middleware/auth.ts]
export default defineNuxtRouteMiddleware(async (to, from) => {
  const nuxtApp = useNuxtApp()
  let user
  try {
    user = await fetchUser()
    // the Vue/Nuxt compiler loses context here because of the try/catch block.
  } catch (e) {
    user = null
  }
  if (!user) {
    // apply the correct Nuxt context to our `navigateTo` call.
    return nuxtApp.runWithContext(() => navigateTo('/auth'))
  }
})
```

#### 使用方式

```ts [Usage]
const result = nuxtApp.runWithContext(() => functionWithContext())
```

- `functionWithContext`：任何需要当前 Nuxt 应用上下文的函数。此上下文将自动正确应用。

`runWithContext` 将返回 `functionWithContext` 返回的任意值。

#### 关于上下文的更深入解释

Vue.js Composition API（类似 Nuxt 组合式函数）通过依赖隐式上下文来工作。在生命周期过程中，Vue 会将当前组件（以及 nuxtApp 的临时实例）的临时实例设置为全局变量，并在同一时刻将其取消。在服务器端渲染时，来自不同用户的多个请求会在同一个全局上下文中运行。因此，Nuxt 和 Vue 会立即取消这个全局实例，以避免两个用户或组件之间共享引用。

它的含义是什么？Composition API 和 Nuxt 组合式函数仅在生命周期期间以及任何异步操作之前立即可用：

```ts [Conceptual Example]
// --- Vue internal ---
const _vueInstance = null
const getCurrentInstance = () => _vueInstance
// ---

// Vue / Nuxt sets a global variable referencing to current component in _vueInstance when calling setup()
async function setup () {
  getCurrentInstance() // Works
  await someAsyncOperation() // Vue unsets the context in same tick before async operation!
  getCurrentInstance() // null
}
```

传统的解决方案是在首次调用时将当前实例缓存到本地变量中，例如 `const instance = getCurrentInstance()`，并在后续的组合式函数调用中使用该实例。但问题在于，任何嵌套的组合式函数调用现在需要显式接受该实例作为参数，而不依赖于 Composition API 的隐式上下文。这是组合式函数的设计限制，并非根本问题。

为了克服这一限制，Vue 在编译应用程序代码时会进行一些幕后工作，并在每次调用后恢复上下文，适用于 `<script setup>`：

```ts [Compiled Output]
const __instance = getCurrentInstance() // Generated by Vue compiler
getCurrentInstance() // Works!
await someAsyncOperation() // Vue unsets the context
__restoreInstance(__instance) // Generated by Vue compiler
getCurrentInstance() // Still works!
```

关于 Vue 实际工作原理的更详细描述，请参阅 [unjs/unctx#2 (评论)](https://github.com/unjs/unctx/issues/2#issuecomment-942193723)。

#### 解决方案

此时可以使用 `runWithContext` 来恢复上下文，其原理与 `<script setup>` 的工作方式类似。

Nuxt 内部使用 [unjs/unctx](https://github.com/unjs/unctx) 来支持类似于 Vue 的组合式函数，用于插件和中间件。这使得像 `navigateTo()` 这样的组合式函数无需直接传递 `nuxtApp` 即可正常工作——从而将 Composition API 的开发体验和性能优势应用到整个 Nuxt 框架中。

Nuxt 组合式函数的设计与 Vue Composition API 相同，因此也需要类似的解决方案来实现这种转换。请查看 [unjs/unctx#2](https://github.com/unjs/unctx/issues/2)（提案）、[unjs/unctx#4](https://github.com/unjs/unctx/pull/4)（转换实现）以及 [nuxt/framework#3884](https://github.com/nuxt/framework/pull/3884)（与 Nuxt 的集成）。

目前 Vue 仅支持 `<script setup>` 中的异步上下文恢复，用于 async/await 用法。在 Nuxt 中，为 `defineNuxtPlugin()` 和 `defineNuxtRouteMiddleware()` 添加了转换支持，这意味着当你使用它们时，Nuxt 会自动进行转换并恢复上下文。

#### 剩余问题

包含 `await` 的 `try/catch` 语句导致的 `unjs/unctx` 自动恢复上下文的转换似乎存在缺陷，最终需要解决这一问题，以消除上述替代方案的必要性。

#### 原生异步上下文

通过使用新的实验性功能，可以利用 [Node.js `AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) 和新的 unctx 支持，使原生异步上下文支持生效。这样，**任何嵌套的异步组合式函数**都可以**直接**使用异步上下文，而无需进行转换或手动传递/调用上下文。

::tip
目前，原生异步上下文支持已在 Bun 和 Node 中实现。
::

:read-more{to="/docs/guide/going-further/experimental-features#asynccontext"}

## tryUseNuxtApp :badge[v3.10]{color="info" size="xs" class="align-middle"}

此函数与 `useNuxtApp` 功能完全相同，但如果上下文不可用，它会返回 `null`，而不是抛出异常。

你可以将其用于不需要 `nuxtApp` 的组合式函数，或者用于检查上下文是否可用，而不会出现异常。

使用示例：

```ts [composable.ts]
export function useStandType () {
  // Always works on the client
  if (tryUseNuxtApp()) {
    return useRuntimeConfig().public.STAND_TYPE
  } else {
    return process.env.STAND_TYPE
  }
}
```

<!-- ### Params

- `appName`：可选的应用程序名称。如果你不提供，则使用 Nuxt `buildId` 选项；否则，必须与现有的 `buildId` 匹配。 -->
