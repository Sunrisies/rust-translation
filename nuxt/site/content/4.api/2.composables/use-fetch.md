---
title: useFetch
description: 使用一个适合 SSR 的组合式函数从 API 端点获取数据。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

该组合式函数为 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 和 [`$fetch`](/docs/api/utils/dollarfetch) 提供了一个便捷的包装器。
它自动生成请求密钥，根据服务器路由提供请求 URL 的类型提示，并推断 API 响应类型。

::note
`useFetch` 是一个可以在 setup 函数、插件或路由中间件中直接调用的组合式函数。它返回响应式组合式函数，并处理将响应添加到 Nuxt 负载中，以便在页面 hydration 时从服务器传递到客户端，而无需在客户端重新获取数据。
::

## 使用方式

```vue [app/pages/modules.vue]
<script setup lang="ts">
const { data, status, error, refresh, clear } = await useFetch('/api/modules', {
  pick: ['title'],
})
</script>
```

::tip{to="/docs/guide/recipes/custom-usefetch#recipe-api-client-with-auth"}
需要一个具有预定义默认值的自定义 `useFetch`（如 `baseURL` 或认证头）吗？使用 `createUseFetch` 创建完全类型化的自定义组合式函数。
::

::note
无需使用 `await` 调用 `useFetch`。在服务器上，Nuxt 会在渲染前等待 Promise 解决，因此返回的 HTML 始终包含数据。`await` 影响调用后的行为：使用 `await` 时，执行会暂停直到 `data` 填充完成，客户端导航会被阻止；不使用 `await` 时，执行立即继续，`data` 以默认值开始，直到请求解决，在客户端导航时，您可以使用返回的 `status` 和 `error` 引用自行处理加载和错误状态。这具有与 [`lazy`](#parameters) 选项类似的效果，不过 `lazy` 是明确选择非阻塞导航的方式。
::

::note
`data`、`status` 和 `error` 是 Vue 引用，在 `<script setup>` 中使用时应通过 `.value` 访问，而 `refresh`/`execute` 和 `clear` 则是普通函数。
::

使用 `query` 选项，您可以添加搜索参数到查询中。该选项基于 [unjs/ofetch](https://github.com/unjs/ofetch) 扩展，并使用 [unjs/ufo](https://github.com/unjs/ufo) 生成 URL。对象会自动被字符串化。

```ts [app/pages/index.vue]
const param1 = ref('value1')
const { data, status, error, refresh } = await useFetch('/api/modules', {
  query: { param1, param2: 'value2' },
})
```

上述示例会生成 `https://api.nuxt.com/modules?param1=value1&param2=value2`。

您也可以使用 [拦截器](https://github.com/unjs/ofetch#%EF%B8%8F-interceptors)：

```ts [app/pages/index.vue]
const { data, status, error, refresh, clear } = await useFetch('/api/auth/login', {
  onRequest ({ request, options }) {
    // Set the request headers
    // note that this relies on ofetch >= 1.4.0 - you may need to refresh your lockfile
    options.headers.set('Authorization', '...')
  },
  onRequestError ({ request, options, error }) {
    // Handle the request errors
  },
  onResponse ({ request, response, options }) {
    // Process the response data
    localStorage.setItem('token', response._data.token)
  },
  onResponseError ({ request, response, options }) {
    // Handle the response errors
  },
})
```

### 响应式键和共享状态

您可以使用计算引用或普通引用作为 URL，从而实现动态数据获取，当 URL 改变时自动更新：

```vue [app/pages/[id\\].vue]
<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id)

// When the route changes and id updates, the data will be automatically refetched
const { data: post } = await useFetch(() => `/api/posts/${id.value}`)
</script>
```

自动生成的键对于每个调用点都是唯一的，因此在不同组件中使用相同的 URL 和选项调用 `useFetch` **不会**共享状态，每次调用都会执行独立的请求。相同组件的多个实例会共享状态，因为它们使用同一个调用点。若要在不同组件间共享相同的 `data`、`error` 和 `status` 引用，请在每次调用时提供相同的显式 `key`：

::code-group

```vue [app/components/ComponentA.vue]
<script setup lang="ts">
// shares the data with ComponentB - only one request is made
const { data } = await useFetch('/api/random', { key: 'random' })
</script>
```

```vue [app/components/ComponentB.vue]
<script setup lang="ts">
// shares the data with ComponentA - only one request is made
const { data } = await useFetch('/api/random', { key: 'random' })
</script>
```

::

::tip
使用 `useFetch` 创建的带键状态可以通过 [`useNuxtData`](/docs/api/组合式函数/use-nuxt-data)在您的 Nuxt 应用中获取。
::

::warning
`useFetch` 是编译器转换后的保留函数名，因此您不应将自己的函数命名为 `useFetch`。若需创建具有预定义选项的自定义版本，请使用 [`createUseFetch`](/docs/api/组合式函数/create-use-fetch)。
::

::warning
如果您发现从 `useFetch` 解构出的 `data` 变量返回的是字符串而非解析后的 JSON 对象，请确保您的组件中没有包含类似 `import { useFetch } from '@vueuse/core` 的导入语句。
::

:video-accordion{title="Watch the video from Alexander Lichter to avoid using useFetch the wrong way" videoId="njsGVmcWviY"}

:read-more{to="/docs/getting-started/data-fetching"}

### 响应式 Fetch 选项

fetch 选项可以设置为响应式形式，支持 `computed`、`ref` 和 [computed getters](https://vuejs.org/guide/essentials/computed)。当响应式 fetch 选项更新时，将使用更新后的响应式值触发重新请求。

```ts [app/pages/index.vue]
const searchQuery = ref('initial')
const { data } = await useFetch('/api/search', {
  query: { q: searchQuery },
})
// triggers a refetch: /api/search?q=new%20search
searchQuery.value = 'new search'
```

如果需要，可以使用 `watch: false` 禁用此行为：

```ts [app/pages/index.vue]
const searchQuery = ref('initial')
const { data } = await useFetch('/api/search', {
  query: { q: searchQuery },
  watch: false,
})
// does not trigger a refetch
searchQuery.value = 'new search'
```

## 类型

```ts [Signature]
export function useFetch<ResT, ErrorT = NuxtError<unknown>, DataT = ResT> (
  url: string | Request | Ref<string | Request> | (() => string | Request),
  options?: UseFetchOptions<ResT, DataT>,
): AsyncData<DataT, ErrorT> & Promise<AsyncData<DataT, ErrorT>>

type UseFetchOptions<ResT, DataT = ResT> = {
  key?: MaybeRefOrGetter<string>
  method?: MaybeRefOrGetter<string>
  query?: MaybeRefOrGetter<SearchParams>
  params?: MaybeRefOrGetter<SearchParams>
  body?: MaybeRefOrGetter<RequestInit['body'] | Record<string, any>>
  headers?: MaybeRefOrGetter<Record<string, string> | [key: string, value: string][] | Headers>
  baseURL?: MaybeRefOrGetter<string>
  cache?: false | 'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload'
  server?: boolean
  lazy?: boolean
  immediate?: boolean
  getCachedData?: (key: string, nuxtApp: NuxtApp, ctx: AsyncDataRequestContext) => DataT | undefined
  deep?: boolean
  dedupe?: 'cancel' | 'defer'
  timeout?: number
  enabled?: MaybeRefOrGetter<boolean>
  serialize?: boolean
  middleware?: AsyncDataMiddleware<ResT>[]
  default?: () => DataT | Ref<DataT>
  transform?: (input: ResT) => DataT | Promise<DataT>
  pick?: string[]
  $fetch?: typeof globalThis.$fetch
  watch?: MultiWatchSources | false
}

type AsyncDataRequestContext = {
  /** The reason for this data request */
  cause: 'initial' | 'refresh:manual' | 'refresh:hook' | 'watch'
}

type AsyncData<DataT, ErrorT> = {
  data: Ref<DataT | undefined>
  pending: Ref<boolean>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  clear: () => void
  error: Ref<ErrorT | undefined>
  status: Ref<AsyncDataRequestStatus>
}

interface AsyncDataExecuteOptions {
  dedupe?: 'cancel' | 'defer'
  timeout?: number
  signal?: AbortSignal
}

type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'
```

## 参数

- `URL` (`string | Request | Ref<string | Request> | () => string | Request`): 要获取的 URL 或请求。可以是字符串、Request 对象、Vue ref，或返回字符串/Request 的函数。支持动态端点的响应式功能。

- `options` (object): fetch 请求的配置。扩展 [unjs/ofetch](https://github.com/unjs/ofetch) 选项和 [`AsyncDataOptions`](/docs/api/组合式函数/use-async-data#parameters)。所有选项可以是静态值、ref 或 computed 值。

| 选项                                                                    | 类型                                                                    | 默认值    | 描述                                                                                                                                                                                                                                                                        |
|---------------------------------------------------------------------------|-------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `key`                                                                     | `MaybeRefOrGetter<string>`                                              | auto-gen   | 用于去重的唯一键。如果未提供，则从 URL、选项以及源代码中的调用位置生成。                                                                                                                                                     |
| `method`                                                                  | `MaybeRefOrGetter<string>`                                              | `'GET'`    | HTTP 请求方法。                                                                                                                                                                                                                                                               |
| `query`                                                                   | `MaybeRefOrGetter<SearchParams>`                                        | -          | 要添加到 URL 的查询/搜索参数。别名：`params`。                                                                                                                                                                                                                         |
| `params`                                                                  | `MaybeRefOrGetter<SearchParams>`                                        | -          | `query` 的别名。                                                                                                                                                                                                                                                                 |
| `body`                                                                    | `MaybeRefOrGetter<RequestInit['body'] \| Record<string, any>>`          | -          | 请求体。对象会自动被转换为字符串格式。                                                                                                                                                                                                                               |
| `headers`                                                                 | `MaybeRefOrGetter<Record<string, string> \| [key, value][] \| Headers>` | -          | 请求头。                                                                                                                                                                                                                                                                   |
| `baseURL`                                                                 | `MaybeRefOrGetter<string>`                                              | -          | 请求的基础 URL。                                                                                                                                                                                                                                                          |
| `cache`                                                                   | `false \| string`                                                       | -          | 缓存控制。布尔值表示禁用缓存，或使用 Fetch API 的值：`default`、`no-store` 等。                                                                                                                                                                                        |
| `server`                                                                  | `boolean`                                                               | `true`     | 是否在服务器上获取数据。                                                                                                                                                                                                                                                    |
| `lazy`                                                                    | `boolean`                                                               | `false`    | 如果为 true，则在路由加载后解析（不会阻止导航）。                                                                                                                                                                                                                   |
| `immediate`                                                               | `boolean`                                                               | `true`     | 如果为 `false`，则防止请求立即触发。                                                                                                                                                                                                                                |
| `default`                                                                 | `() => DataT`                                                           | -          | 在异步解析之前，用于生成 `data` 默认值的工厂函数。                                                                                                                                                                                                                         |
| `timeout` :badge[v4.2]{color="info" size="xs" class="align-middle"}       | `number`                                                                | -          | 等待的毫秒数，用于在请求超时前停止处理（默认值为 `undefined`，表示无超时）。                                                                                                                                           |
| `transform`                                                               | `(input: DataT) => DataT \| Promise<DataT>`                             | -          | 在解析后对结果进行转换的函数。                                                                                                                                                                                                                                  |
| `getCachedData` :badge[v3.8]{color="info" size="xs" class="align-middle"} | `(key, nuxtApp, ctx) => DataT \| undefined`                             | -          | 用于返回缓存数据的函数。请参阅下方默认配置。                                                                                                                                                                                                                             |
| `pick`                                                                    | `string[]`                                                              | -          | 仅从结果中选取指定的键。                                                                                                                                                                                                                                          |
| `watch`                                                                   | `MultiWatchSources \| false`                                            | -          | 需要观察和自动刷新的反应式源数组。`false` 禁用观察。                                                                                                                                                                                                    |
| `deep` :badge[v3.8]{color="info" size="xs" class="align-middle"}          | `boolean`                                                               | `false`    | 以 deep ref 对象形式返回数据。为提升性能，默认值为 `false`（浅 ref 对象）。                                                                                                                                                                               |
| `dedupe` :badge[v3.9]{color="info" size="xs" class="align-middle"}        | `'cancel' \| 'defer'`                                                   | `'cancel'` | 避免同时获取相同的键多次。                                                                                                                                                                                                                                  |
| `enabled` :badge[v4.5]{color="info" size="xs" class="align-middle"}       | `boolean`                                                               | `true`     | 控制请求是否执行的屏障。当 `false` 时，所有执行都被阻止（初始获取、`execute`/`refresh` 以及观察触发），将 `true` 切换为 `false` 会取消正在进行的请求，而不会清除 `data`。重新启用后不会自动重新获取数据。 |
| `serialize` :badge[v4.6]{color="info" size="xs" class="align-middle"}     | `boolean`                                                               | `true`     | 是否将解析后的数据存储在 Nuxt 负载中（`__NUXT_DATA__`）。当 `false` 时，服务器获取的数据不会包含在负载中，如果组件渲染该数据，客户端将在 hydration 后重新请求。结合 [懒加载 hydration](/docs/guide/best-practices/performance#lazy-hydration) 使用，可以避免 hydration 不匹配和不必要的客户端请求。 |
| `middleware` :badge[v4.6]{color="info" size="xs" class="align-middle"}    | `AsyncDataMiddleware[]`                                                 | -          | 包裹请求执行的函数。每个函数都接收 `next` 参数，该参数会执行链中的剩余部分并解析为数据，同时还会接收处理上下文（`{ signal }`）。第一个条目是最外层的包装器。调用 `next()` 可以继续执行，或抛出异常以中止。 |
| `$fetch` :badge[v3.2]{color="info" size="xs" class="align-middle"}        | `typeof globalThis.$fetch`                                              | -          | 自定义 $fetch 实现。参见 [Nuxt 中的自定义 useFetch](/docs/guide/recipes/custom-usefetch)                                                                                                                                                                               |

::note
所有 fetch 选项都可以指定 `computed` 或 `ref` 值。这些值会被监视，如果它们发生变化，新的请求会自动发起（除非 `watch` 设置为 `false`）。
::

**getCachedData 默认设置：**

```ts [Default getCachedData Implementation]
const getDefaultCachedData = (key, nuxtApp, ctx) => nuxtApp.isHydrating
  ? nuxtApp.payload.data[key]
  : nuxtApp.static.data[key]
```
仅在 `nuxt.config` 中启用 `experimental.payloadExtraction` 时，才会缓存数据。

## 返回值

此组合式函数返回一个可以等待的 `Promise`，使得可以在 `<script setup>` 中直接使用 `data`（即该值会存在，而不是 undefined）。您也可以直接获取值而不等待返回值的完成，在这种情况下，`data` 在 `<script setup>` 中可以为 undefined，直到 fetch 完成。

::tip
即使您不等待返回值的完成，在 SSR 期间 Nuxt 也会等待请求完成并将解析后的数据发送给客户端。
::

::note
如果您未在服务器上获取数据（例如使用 `server: false`），则直到 hydration 完成之前不会获取数据。这意味着即使在客户端侧等待 `useFetch`，`data` 在 `<script setup>` 中仍将为 undefined。
::

| 名称      | 类型                                                | 描述                                                                                                                                                       |
|-----------|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data`    | `Ref<DataT \| undefined>`                           | 异步获取的结果。                                                                                                                             |
| `refresh` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | 手动刷新数据的函数。默认情况下，Nuxt 会等待 `refresh` 完成后再执行下一次操作。                                      |
| `execute` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | `refresh` 的别名。                                                                                                                                              |
| `error`   | `Ref<ErrorT \| undefined>`                          | 数据获取失败的错误对象。                                                                                                                         |
| `status`  | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>`  | 数据请求的状态。用于区分 `idle`、`pending`、`success` 和 `error`。                                                                      |
| `pending` | `Ref<boolean>`                                      | 当请求正在处理时的值为 `true`。使用 [`experimental.pendingWhenIdle`](/docs/guide/going-further/experimental-features#pendingwhenidle) 后，当 `status` 为 `idle` 且没有缓存数据时也为 `true`。 |
| `clear`   | `() => void`                                        | 将 `data` 重置为 `undefined`（或提供的 `options.default()` 的值），将 `error` 重置为 `undefined`，将 `status` 设置为 `idle`，并取消所有待处理请求。 |

::tip
如果未等待 `Promise` 的返回值，可以从 `Promise` 函数中安全地解构 `then`、`catch` 和 `finally` 函数。
::

### 状态值

- `idle`: 请求尚未开始（例如在服务器渲染时为 `{ immediate: false }` 或 `{ server: false }`）
- `pending`: 请求正在进行中
- `success`: 请求成功完成
- `error`: 请求失败

### 示例

:link-example{to="/docs/examples/advanced/use-custom-fetch-composable"}

:link-example{to="/docs/examples/features/data-fetching"}
