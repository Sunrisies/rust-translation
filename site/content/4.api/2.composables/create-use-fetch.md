---
title: createUseFetch
description: 一个工厂函数，用于创建带有预定义默认选项的自定义组合式函数 useFetch。
minimalVersion: "4.4"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

`createUseFetch` 创建一个带有预定义选项的自定义 [`useFetch`](/docs/api/组合式函数/use-fetch) 组合式函数。生成的组合式函数具有完整的类型信息，其行为与 `useFetch` 完全相同，但默认选项已内置其中。

::note
`createUseFetch` 是一个编译器宏。它必须作为 **导出** 声明使用在 `composables/` 目录中（或 Nuxt 编译器扫描的任何目录中）。Nuxt 会在构建时自动注入去重键。
::

## 用法

```ts [app/composables/useAPI.ts]
export const useAPI = createUseFetch({
  baseURL: 'https://api.nuxt.com',
})
```

```vue [app/pages/modules.vue]
<script setup lang="ts">
const { data: modules } = await useAPI('/modules')
</script>
```

生成的 `useAPI` 组合式函数具有与 [`useFetch`](/docs/api/组合式函数/use-fetch) 相同的签名和返回类型，所有选项都可供调用者使用或覆盖。

## 类型

```ts [Signature]
function createUseFetch (
  options?: Partial<UseFetchOptions> & { addons?: UseFetchAddon[] },
): typeof useFetch

function createUseFetch (
  options: (callerOptions: UseFetchOptions) => Partial<UseFetchOptions>,
): typeof useFetch

function createUseFetch<Routes> (
  options: Partial<UseFetchOptions> & { routes: Routes, addons?: UseFetchAddon[] },
): DeclaredUseFetch<Routes>
```

返回的组合式函数的签名包含由 [addons](#addons) 提供的任何自定义选项和返回值扩展。

## 选项

`createUseFetch` 接受与 [`useFetch`](/docs/api/组合式函数/use-fetch#parameters) 相同的所有选项，包括 `baseURL`、`headers`、`query`、`onRequest`、`onResponse`、`server`、`lazy`、`transform`、`getCachedData` 等。

请参见 [`useFetch` 文档](/docs/api/组合式函数/use-fetch#parameters)中的完整选项列表。

## 为第三方 API 添加类型

从 Nuxt 4.6 开始，可以将 `routes` 传递给组合式函数调用的 API 描述。其响应、查询参数和请求体都来自该路由集，包括当 `experimental.routeTypedFetch` 关闭时：
and request bodies are typed from that route set, including when `experimental.routeTypedFetch` is off:

```ts [app/composables/usePetStore.ts]
import type { DynamicParam, Endpoint } from 'nuxt/app'

interface Pet { id: number, name: string }

interface PetStoreRoutes {
  '/pets': {
    [Endpoint]: {
      GET: { response: Pet[], query: { limit?: number } }
      POST: { response: Pet, body: { name: string } }
    }
    [DynamicParam]: {
      [Endpoint]: { GET: { response: Pet } }
    }
  }
}

export const usePetStore = createUseFetch({
  baseURL: 'https://api.example.com',
  routes: {} as PetStoreRoutes,
})
```

```vue [app/pages/pets.vue]
<script setup lang="ts">
const { data: pets } = await usePetStore('/pets', { query: { limit: 10 } })
const { data: pet } = await usePetStore('/pets/42')
await usePetStore('/pets', { method: 'post', body: { name: 'Rex' } })
</script>
```

`pets.value` 被定义为 `Pet[] | undefined`，而 `pet.value` 为 `Pet | undefined`。`POST`
请求需要包含带有 `name` 字符串的体。

只有 `routes` 的类型会被读取，因此应传递 `{} as Routes`；该值在请求发出前会被丢弃。声明的路径按**原样**匹配，不要在其前添加 `baseURL`。
在运行时构建的路径会解析为 `unknown`。
A path built at runtime resolves to `unknown`.

未匹配的路径和方法默认被接受，并解析为 `unknown`。要拒绝它们，请启用
[`routeTypedFetch`](/docs/guide/going-further/experimental-features#routetypedfetch) 和
[`strictRouteTypes`](/docs/guide/going-further/experimental-features#strictroutetypes)：

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  experimental: {
    routeTypedFetch: true,
    strictRouteTypes: true,
  },
})
```

启用这些选项后，`usePetStore('/pats')` 和
`usePetStore('/pets', { method: 'put' })` 都会产生类型错误。

::note
客户端声明的路由属于其自身。这些路由不会被添加到你的应用路由集合中，因此它们是纯
`$fetch` 和 `useFetch` 不受影响。该客户端针对其声明的路由发送请求，
而不是你的服务器路由。
::

::tip
上述接口正是 [`fetchdts`](https://github.com/unjs/fetchdts) 使用的格式。一个模块可以
从 API 描述（如 OpenAPI 文档）中通过 `compileRoutes` 生成一个接口，并将生成的接口传递给 `routes`。
`fetchdts/compiler`, and pass the emitted interface to `routes`.
::

## 默认模式与覆盖模式

### 默认模式（纯对象）

当你传递一个纯对象时，工厂选项会作为**默认值**使用。调用者可以覆盖任何选项：

```ts [app/composables/useAPI.ts]
export const useAPI = createUseFetch({
  baseURL: 'https://api.nuxt.com',
  lazy: true,
})
```

```ts
// Uses the default baseURL
const { data } = await useAPI('/modules')

// Caller overrides the baseURL
const { data } = await useAPI('/modules', { baseURL: 'https://other-api.com' })
```

### 覆盖模式（函数）

当你传递一个函数时，工厂选项会**覆盖**调用者的选项。该函数将调用者的选项作为参数传入，因此你可以读取这些选项来计算自己的覆盖值：

```ts [app/composables/useAPI.ts]
// baseURL is always enforced, regardless of what the caller passes
export const useAPI = createUseFetch(callerOptions => ({
  baseURL: 'https://api.nuxt.com',
}))
```

这适用于强制执行诸如认证头信息或特定基础 URL 等设置，这些设置不应由调用者更改。

## 与自定义 `$fetch` 结合使用

你可以将自定义的 `$fetch` 实例传递给 `createUseFetch`：

```ts [app/composables/useAPI.ts]
export const useAPI = createUseFetch(callerOptions => ({
  $fetch: useNuxtApp().$api as typeof $fetch,
  ...callerOptions,
}))
```

::important
这里需要**函数签名**（覆盖模式），以便 [`useNuxtApp()`](/docs/api/组合式函数/use-nuxt-app) 在 setup 上下文中（在组合式函数的调用位置）被调用，而不是在模块作用域中，因为那里没有 Nuxt 实例可用。
::

## 插件

除了 `useFetch` 选项外，`createUseFetch` 还接受 `addons` 数组。插件是可重复使用的行为单元，通过 [`defineUseFetchAddon`](/docs/api/utils/define-use-fetch-addon) 定义。它们可以声明自定义调用点选项、在处理器前后运行中间件、扩展返回的对象，以及为组合式函数附加自定义逻辑。

例如，一个插件可以在窗口重新获得焦点时刷新数据，并通过自定义的 `refreshOnFocus` 选项进行保护，因此调用者在每次调用时可以选择启用该功能：

```ts [app/composables/useCustomFetch.ts]
const refreshOnFocus = defineUseFetchAddon({
  // augment the call-site options for the custom useFetch instance 👇
  setup: (options: UseFetchAddonOptions<{ refreshOnFocus?: boolean }>) => {
    // 👈 run code *before* calling `useAsyncData` in `useFetch`
    if (import.meta.server || !options.refreshOnFocus) { return }

    return (asyncData) => {
      // 👈 run code *after* calling `useAsyncData` in `useFetch`
      const focused = useWindowFocus()
      watch(focused, (focused) => {
        if (focused) { asyncData.refresh() }
      })

      return { focused } // 👈 extend the returned object with a new property
    }
  },
})

export const useCustomFetch = createUseFetch({ addons: [refreshOnFocus] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// `refreshOnFocus` is typed on the created composable
const { data } = await useCustomFetch(
  'https://api.nuxtjs.dev/mountains',
  { refreshOnFocus: true },
)
</script>
```

:read-more{to="/docs/api/utils/define-use-fetch-addon"}

:read-more{to="/docs/guide/recipes/custom-usefetch"}

:read-more{to="/docs/api/composables/use-fetch"}
