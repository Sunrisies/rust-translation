---
title: useAsyncData
description: useAsyncData 提供对在 SSR 环境中异步解析的数据的访问权限，适用于组合式函数。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

在您的页面、组件和插件中，可以使用 useAsyncData 来获取异步解析的数据。

::note
[`useAsyncData`](/docs/api/组合式函数/use-async-data) 是一个可以在 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)中直接调用的组合式函数。它返回响应式组合式函数，并负责将响应数据添加到 Nuxt 负载中，这样在页面动态化时，数据就可以从服务器传递到客户端，**而无需在客户端重新获取数据**。
::

## 使用方式

```vue [app/pages/index.vue]
<script setup lang="ts">
const { data, status, pending, error, refresh, clear } = await useAsyncData(
  'mountains',
  (_nuxtApp, { signal }) => $fetch('https://api.nuxtjs.dev/mountains', { signal }),
)
</script>
```

::tip{to="/docs/api/composables/create-use-async-data"}
需要具有预定义默认值的自定义 `useAsyncData` 吗？使用 `createUseAsyncData` 创建完全类型化的自定义组合式函数。有关详细信息，请参阅 [自定义 useFetch 指南](/docs/guide/recipes/custom-usefetch)。
::

::note
无需使用 `await` 调用 `useAsyncData`。在服务器上，Nuxt 会在渲染前等待 Promise 解析，因此返回的 HTML 始终包含数据。`await` 影响调用后的行为：使用 `await` 时，执行会暂停直到 `data` 填充完成，客户端导航会被阻止；不使用 `await` 时，执行立即继续，`data` 以默认值开始，直到请求解析完成，在客户端导航时，您可以使用返回的 `status` 和 `error` 引用来处理加载和错误状态。这具有与 [`lazy`](#parameters) 选项类似的效果，不过 `lazy` 是明确选择非阻塞导航的方式。
::

::note
`data`、`status`、`pending` 和 `error` 是 Vue 引用。在 `<script setup>` 中通过 `.value` 访问它们的值。`refresh`/`execute` 和 `clear` 是简单函数。
::

### 观察参数

内置的 `watch` 选项允许在检测到任何变化时自动重新运行获取器函数。

```vue [app/pages/index.vue]
<script setup lang="ts">
const page = ref(1)
const { data: posts } = await useAsyncData(
  'posts',
  (_nuxtApp, { signal }) => $fetch('https://fakeApi.com/posts', {
    params: {
      page: page.value,
    },
    signal,
  }), {
    watch: [page],
  },
)
</script>
```

### 响应式键

您可以使用计算属性引用、简单引用或 getter 函数作为键，从而实现动态数据获取，当键发生变化时自动更新：

```vue [app/pages/[id\\].vue]
<script setup lang="ts">
const route = useRoute()
const userId = computed(() => `user-${route.params.id}`)

// When the route changes and userId updates, the data will be automatically refetched
const { data: user } = useAsyncData(
  userId,
  () => fetchUserById(route.params.id),
)
</script>
```

### 使您的 `handler` 可中止

您可以通过第二个参数提供的 `signal` 使 `handler` 函数可中止。这对于取消不再需要的请求非常有用，例如当用户从页面导航离开时。`$fetch` 原生支持中止信号。

```ts [app/pages/index.vue]
const { data, error } = await useAsyncData(
  'users',
  (_nuxtApp, { signal }) => $fetch('/api/users', { signal }),
)

refresh() // will actually cancel the $fetch request (if dedupe: cancel)
refresh() // will actually cancel the $fetch request (if dedupe: cancel)
refresh()

clear() // will cancel the latest pending handler
```

您还可以将 `AbortSignal` 传递给 `refresh`/`execute` 函数，以手动取消单个请求。

```ts [app/pages/index.vue]
const { refresh } = await useAsyncData(
  'users',
  (_nuxtApp, { signal }) => $fetch('/api/users', { signal }),
)
let abortController: AbortController | undefined

function handleUserAction () {
  abortController = new AbortController()
  refresh({ signal: abortController.signal })
}

function handleCancel () {
  abortController?.abort() // aborts the ongoing refresh request
}
```

如果您的 `handler` 函数不支持中止信号，您可以使用提供的 `signal` 实现自己的中止逻辑。

```ts [app/pages/index.vue]
const { data, error } = await useAsyncData(
  'users',
  (_nuxtApp, { signal }) => {
    return new Promise((resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(new Error('Request aborted'))
      })
      return Promise.resolve(callback.call(this, yourHandler)).then(resolve, reject)
    })
  },
)
```

当以下情况发生时，`handler` 信号将被中止：

- 使用 `dedupe: 'cancel'` 发起新请求
- 调用 `clear` 函数
- `options.timeout` 持续时间超过限制

::warning
[`useAsyncData`](/docs/api/组合式函数/use-async-data) 是编译器转换后的保留函数名，因此您不应将您的函数命名为 [`useAsyncData`](/docs/api/组合式函数/use-async-data)。
::

:read-more{to="/docs/getting-started/data-fetching#useasyncdata"}

## 类型

```ts [Signature]
export type AsyncDataHandler<ResT> = (nuxtApp: NuxtApp, options: { signal: AbortSignal }) => Promise<ResT>

export function useAsyncData<ResT, DataE = unknown, DataT = ResT> (
  handler: AsyncDataHandler<ResT>,
  options?: AsyncDataOptions<ResT, DataT>,
): AsyncData<DataT, DataE> & Promise<AsyncData<DataT, DataE>>
export function useAsyncData<ResT, DataE = unknown, DataT = ResT> (
  key: MaybeRefOrGetter<string>,
  handler: AsyncDataHandler<ResT>,
  options?: AsyncDataOptions<ResT, DataT>,
): AsyncData<DataT, DataE> & Promise<AsyncData<DataT, DataE>>

type AsyncDataOptions<ResT, DataT = ResT> = {
  server?: boolean
  lazy?: boolean
  immediate?: boolean
  deep?: boolean
  dedupe?: 'cancel' | 'defer'
  default?: () => DataT | Ref<DataT>
  transform?: (input: ResT) => DataT | Promise<DataT>
  pick?: string[]
  watch?: MultiWatchSources
  getCachedData?: (key: string, nuxtApp: NuxtApp, ctx: AsyncDataRequestContext) => DataT | undefined
  timeout?: number
  enabled?: MaybeRefOrGetter<boolean>
  serialize?: boolean
  middleware?: AsyncDataMiddleware<ResT>[]
}

type AsyncDataMiddleware<ResT> = (next: () => Promise<ResT>, ctx: { signal: AbortSignal }) => Promise<ResT>

type AsyncDataRequestContext = {
  /** The reason for this data request */
  cause: 'initial' | 'refresh:manual' | 'refresh:hook' | 'watch'
}

type AsyncData<DataT, ErrorT> = {
  data: Ref<DataT | undefined>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  clear: () => void
  error: Ref<ErrorT | undefined>
  status: Ref<AsyncDataRequestStatus>
  pending: Ref<boolean>
}

interface AsyncDataExecuteOptions {
  dedupe?: 'cancel' | 'defer'
  timeout?: number
  signal?: AbortSignal
}

type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'
```

:read-more{to="/docs/getting-started/data-fetching"}

## 参数

- `key`: 唯一键，用于确保在多个请求中正确去重数据获取。如果您不提供键，则系统将为您生成由 `useAsyncData` 的文件名和行号决定的唯一键。
- `handler`: 异步函数，必须返回真值（例如不应为 `undefined` 或 `null`），否则客户端可能会重复请求。
::warning
`handler` 函数应**无副作用**，以确保 SSR 和 CSR 水合过程中的可预测行为。如果您需要触发副作用，请使用 [`callOnce`](/docs/api/utils/call-once) 工具函数来实现。
::
- `options` (对象): 异步函数调用的配置。所有选项可以是静态值、`ref` 或计算值。

| 选项                                                                    | 类型                                        | 默认值    | 描述                                                                                                                                                                                                                                                                          |
|---------------------------------------------------------------------------|---------------------------------------------|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `server`                                                                  | `boolean`                                   | `true`     | 是否在服务器上调用该函数                                                                                                                                                                                                                                          |
| `lazy`                                                                    | `boolean`                                   | `false`    | 如果为 true，则在路由加载后解析（不会阻止导航）。                                                                                                                                                                                                                     |
| `immediate`                                                               | `boolean`                                   | `true`     | 如果为 false，则防止函数立即被调用。                                                                                                                                                                                                                           |
| `default`                                                                 | `() => DataT`                               | -          | 在异步解析之前用于设置 `data` 默认值的工厂函数。                                                                                                                                                                                                                           |
| `timeout` :badge[v4.2]{color="info" size="xs" class="align-middle"}       | `number`                                    | -          | 等待的毫秒数，用于在超时前停止调用（默认值为 `undefined`，表示没有超时）。                                                                                                                                      |
| `transform`                                                               | `(input: DataT) => DataT \| Promise<DataT>` | -          | 解析后用于转换结果的函数。                                                                                                                                                                                                                                    |
| `getCachedData` :badge[v3.8]{color="info" size="xs" class="align-middle"} | `(key, nuxtApp, ctx) => DataT \| undefined` | -          | 用于返回缓存数据的函数。请参阅下方默认配置。                                                                                                                                                                                                                               |
| `pick`                                                                    | `string[]`                                  | -          | 仅从结果中选取指定的键。                                                                                                                                                                                                                                            |
| `watch`                                                                   | `MultiWatchSources`                         | -          | 需要观察和自动刷新的反应式源数组。                                                                                                                                                                                                                                 |
| `deep` :badge[v3.8]{color="info" size="xs" class="align-middle"}          | `boolean`                                   | `false`    | 以 deep ref 对象形式返回数据。为提升性能，默认值为 `false`（浅 ref 对象）。                                                                                                                                       |
| `dedupe` :badge[v3.9]{color="info" size="xs" class="align-middle"}        | `'cancel' \| 'defer'`                       | `'cancel'` | 一次同时触发多次执行的策略。                                                                                                                                                                                                                                          |
| `enabled` :badge[v4.5]{color="info" size="xs" class="align-middle"}       | `boolean`                                   | `true`     | 控制 `handler` 是否运行的屏障。当值为 `false` 时，所有执行都被阻止（初始获取、`execute`/`refresh` 以及 watch 触发），将 `true` 切换为 `false` 会取消正在进行的请求，而不会清除 `data`。重新启用后不会自动重新获取数据。 |
| `serialize` :badge[v4.6]{color="info" size="xs" class="align-middle"}     | `boolean`                                   | `true`     | 是否将解析后的数据存储在 Nuxt payload 中（`__NUXT_DATA__`）。当值为 `false` 时，服务器获取的数据不会包含在 payload 中，如果组件渲染该数据，客户端将在 hydration 后重新获取。与 [lazy hydration](/docs/guide/best-practices/performance#lazy-hydration) 结合使用，可避免 hydration 不匹配和不必要的客户端请求。 |
| `middleware` :badge[v4.6]{color="info" size="xs" class="align-middle"}    | `AsyncDataMiddleware[]`                     | -          | 这些函数封装了 `handler` 的执行过程。每个函数接收 `next` 参数，该参数会执行链中的剩余部分并将结果解析为数据以及处理器上下文（`{ signal }`）。第一个条目是最外层的包装器。调用 `next()` 可以继续执行，或抛出异常以中止。

::note
所有选项都可以被赋予 `computed` 或 `ref` 值。这些值会被监视，如果它们发生变化，新的请求会自动使用新的值。
::

**getCachedData 默认设置：**

```ts [Default getCachedData Implementation]
const getDefaultCachedData = (key, nuxtApp, ctx) => nuxtApp.isHydrating
  ? nuxtApp.payload.data[key]
  : nuxtApp.static.data[key]
```
只有在 `nuxt.config` 中启用了 `experimental.payloadExtraction` 时，才会缓存数据。

::note
在底层，`lazy: false` 使用 `<Suspense>` 在数据获取完成之前阻止路由的加载。考虑使用 `lazy: true` 并实现加载状态，以获得更流畅的用户体验。
::

::read-more{to="/docs/api/composables/use-lazy-async-data"}
你可以使用 `useLazyAsyncData` 来获得与 `useAsyncData` 相同的行为，但使用 `useAsyncData`。
::

:video-accordion{title="Watch a video from Alexander Lichter about client-side caching with getCachedData" videoId="aQPR0xn-MMk"}

### 共享状态与选项一致性

当多个 `useAsyncData` 调用使用相同的键时，它们会共享相同的 `data`、`error`、`status` 和 `pending` refs。请确保在这些调用中保持以下选项的一致性。

以下选项**必须在**所有使用相同键的调用中保持一致：
- `handler` 函数
- `deep` 选项
- `transform` 函数
- `pick` 数组
- `getCachedData` 函数
- `default` 值
- `middleware` 数组

以下选项**可以不同**，且不会引发警告：
- `server`
- `lazy`
- `immediate`
- `dedupe`
- `watch`
- `enabled`
- `serialize`

```ts [app/pages/index.vue]
// ❌ This will trigger a development warning
const { data: users1 } = useAsyncData('users', (_nuxtApp, { signal }) => $fetch('/api/users', { signal }), { deep: false })
const { data: users2 } = useAsyncData('users', (_nuxtApp, { signal }) => $fetch('/api/users', { signal }), { deep: true })

// ✅ This is allowed
const { data: users1 } = useAsyncData('users', (_nuxtApp, { signal }) => $fetch('/api/users', { signal }), { immediate: true })
const { data: users2 } = useAsyncData('users', (_nuxtApp, { signal }) => $fetch('/api/users', { signal }), { immediate: false })
```

::tip
使用 `useAsyncData` 创建的键化状态可以通过 [`useNuxtData`](/docs/api/组合式函数/use-nuxt-data) 在您的 Nuxt 应用中获取。
::

## 返回值

此组合式函数返回一个可以等待的 `Promise`，这使得可以在 `<script setup>` 中直接使用 `data`（即值会存在，而不是 undefined）。您也可以直接获取值而不等待返回值，在这种情况下，`data` 在 `<script setup>` 中可以是 undefined，直到请求完成。

::tip
即使您不等待返回值，在 SSR 期间 Nuxt 也会等待请求完成并将解析后的数据发送给客户端。
::

::note
如果您在服务器上没有获取数据（例如，使用 `server: false`），那么数据_不会_在 hydration 完成前被获取。这意味着即使在客户端侧等待 [`useAsyncData`](/docs/api/组合式函数/use-async-data)，`data` 在 `<script setup>` 中仍将是 `undefined`。
::

| 名称      | 类型                                                | 描述                                                                                                                                                       |
|-----------|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data`    | `Ref<DataT \| undefined>`                           | 传入的异步函数的结果。                                                                                                        |
| `refresh` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | 手动刷新数据的函数。默认情况下，Nuxt 会等待 `refresh` 完成后再执行下一次操作。                                      |
| `execute` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | 与 `refresh` 同义。                                                                                                                                              |
| `error`   | `Ref<ErrorT \| undefined>`                          | 如果异步函数抛出异常，则返回错误对象。                                                                                                         |
| `status`  | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>`  | 异步函数调用的状态。用于区分 `idle`、`pending`、`success` 和 `error`。                                                        |
| `pending` | `Ref<boolean>`                                      | 当请求正在处理时的值为 `true`。使用 [`experimental.pendingWhenIdle`](/docs/guide/going-further/experimental-features#pendingwhenidle) 后，当 `status` 为 `idle` 且没有缓存数据时也为 `true`。 |
| `clear`   | `() => void`                                        | 将 `data` 重置为 `undefined`（或提供的 `options.default()` 的值），将 `error` 重置为 `undefined`，将 `status` 设置为 `idle`，并取消所有待处理调用。    |

::tip
如果未等待 `Promise` 的返回值，则可以将 `then`、`catch` 和 `finally` 中的函数安全地进行解构。
::

### 状态值

- `idle`: 函数尚未被调用（例如在服务器渲染时为 `{ immediate: false }` 或 `{ server: false }`）
- `pending`: 函数已被调用，且 Promise 处于待处理状态
- `success`: 返回值的函数
- `error`: 抛出错误的函数
