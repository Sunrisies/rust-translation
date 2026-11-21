---
title: defineUseFetchAddon
description: 定义一个可复用的组合式函数，用于扩展使用 `createUseFetch` 创建的组合式函数。
minimalVersion: "4.6"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/addons.ts
    size: xs
---

`defineUseFetchAddon` 定义了一个可复用的扩展函数，用于扩展使用 [`createUseFetch`](/docs/api/组合式函数/create-use-fetch) 创建的 `useFetch` 组合式函数。

组合式函数可以声明自定义调用站点选项，用中间件包裹处理程序，附加自定义响应式逻辑或扩展返回对象。

## 使用方式

通过 `addons` 数组将组合式函数传递给 `createUseFetch`。

该组合式函数附加自定义逻辑：一个监视器，在窗口重新获得焦点时刷新数据，并通过自定义的 `refreshOnFocus` 选项进行控制：

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
const { data } = await useCustomFetch('/some-endpoint', { refreshOnFocus: true })
</script>
```

组合式函数的 `setup` 函数在每次调用组合式函数时运行，并接收合并后的选项（工厂默认值加上调用者选项）。

::note
组合式函数按照 `addons` 数组的顺序执行，第一个组合式函数的中间件作为最外层的包装器。同一个组合式对象被列出多次只会执行一次。
::

## 自定义选项

通过为 `setup` 的 `options` 参数添加 `UseFetchAddonOptions<{ ... }>` 注解来声明自定义选项。这些选项成为创建的组合式函数的签名的一部分，为调用者提供完全类型化的支持：

```ts [app/composables/useCustomFetch.ts]
const auth = defineUseFetchAddon({
  setup: (options: UseFetchAddonOptions<{ auth?: MaybeRefOrGetter<boolean> }>) => {
    const { token } = useTokenStore()
    options.auth ??= true
    options.onRequest.push(({ options: fetchOptions }) => {
      if (!toValue(options.auth)) { return }
      fetchOptions.headers.set('Authorization', `Bearer ${token.value}`)
    })
  },
})

export const useCustomFetch = createUseFetch({ addons: [auth] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// `auth` is typed
const { data } = await useCustomFetch('/public-endpoint', { auth: false })
</script>
```

自定义选项保留在合并后的选项对象中，因此它们也会与请求选项一起传递给 `$fetch`，而 `$fetch` 会忽略它不识别的键。

## 扩展返回值

如果 `setup` 返回一个函数，该函数将使用异步数据实例调用。它返回的任何对象都会合并到组合式函数的返回值中：

```ts
const timestamps = defineUseFetchAddon({
  setup: () => {
    const refreshedAt = ref<Date>()

    return (asyncData) => {
      watch(asyncData.status, (status) => {
        if (status === 'success') { refreshedAt.value = new Date() }
      }, { immediate: true })

      return { refreshedAt: readonly(refreshedAt) }
    }
  },
})

export const useCustomFetch = createUseFetch({ addons: [timestamps] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// `refreshedAt` is typed
const { data, refreshedAt } = await useCustomFetch('/modules')
</script>
```

## 中间件

中间件包裹请求处理程序的执行。调用 `next()` 可以继续链（并获取解析后的数据），或抛出异常以中止。第一个组合式函数的中间件作为最外层的包装器：

```ts
const minDuration = defineUseFetchAddon({
  setup: (options: UseFetchAddonOptions<{ minDuration?: number }>) => {
    options.middleware.push(async (next) => {
      const [result] = await Promise.all([
        next(),
        new Promise(resolve => setTimeout(resolve, toValue(options.minDuration) ?? 300)),
      ])
      return result
    })
  },
})
```

## 对自动生成的密钥的贡献

默认情况下，自定义选项**不属于**自动生成的密钥。如果自定义选项影响响应，请提供 `key` 解析器，这样具有不同值的调用不会共享缓存条目。返回可序列化值，或返回 `undefined` 以不贡献任何内容：

```ts
const scoped = defineUseFetchAddon({
  setup: (options: UseFetchAddonOptions<{ scope?: string }>) => {
    options.scope ??= 'default'
    // ...
  },
  key: options => toValue(options.scope),
})
```

::warning
在 `key` 之前声明 `setup`。TypeScript 从 `setup` 参数注解中推断自定义选项，首先检查在 `setup` 之前编写的返回扩展函数的 `key` 解析器，并为其分配空选项进行类型化。
::

## 包裹 `then`、`catch` 和 `finally` 函数

作为一种高级的备用方案，扩展对象可以包含 `then`、`catch` 或 `finally` 函数。这些函数不会合并到实例中，而是包裹 awaitable 承诺对应的方法，并将原始方法作为其第一个参数。

::note
当多个插件包裹同一个方法时，包装器将按照 `addons` 数组的顺序组合：第一个插件的包装器会包裹所有后续的包装器，就像其中间件一样。
::

## 类型

```ts [Signature]
function defineUseFetchAddon<Opts extends Record<string, any> = {}, Ext = {}> (addon: {
  setup: (options: UseFetchAddonOptions<Opts>) => ((asyncData: AsyncDataAddonInstance) => Ext | void) | void
  key?: (options: UseFetchAddonOptions<Opts>) => SerializableValue
}): UseFetchAddon<Opts, Ext>
```

::note
`middleware`、`onRequest`、`onRequestError`、`onResponse` 和 `onResponseError` 总是被转换为数组，因此来自调用者和其他插件的拦截器得以保留。
::
