---
title: reloadNuxtApp
description: reloadNuxtApp 将执行页面的强制重新加载。
minimalVersion: "3.3"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/chunk.ts
    size: xs
---

::note
`reloadNuxtApp` 将强制重新加载您的应用，从服务器重新请求页面及其依赖项。
::

默认情况下，它还将保存您应用的当前 `state`（即您可以通过 `useState` 访问的任何状态）。

::read-more{to="/docs/guide/going-further/experimental-features#restorestate" icon="i-lucide-star"}
您可以在 `nuxt.config` 文件中启用 `experimental.restoreState` 选项，以启用此状态的实验性恢复。
::

## 类型

```ts [Signature]
export function reloadNuxtApp (options?: ReloadNuxtAppOptions)

interface ReloadNuxtAppOptions {
  ttl?: number
  force?: boolean
  path?: string
  persistState?: boolean
}
```

### `options`（可选）

**类型**: `ReloadNuxtAppOptions`

这是一个接受以下属性的对象：

- `path`（可选）

  **类型**: `string`

  **默认值**: `window.location.pathname`

  要重新加载的路径（默认为当前路径）。如果此路径与当前窗口位置不同，则
  将触发导航并在浏览器历史记录中添加一条记录。

- `ttl`（可选）

  **类型**: `number`

  **默认值**: `10000`

  在多长时间内不处理未来的重新加载请求。如果在此时间内再次调用，
  `reloadNuxtApp` 将不会重新加载您的应用，以避免循环重新加载。

- `force`（可选）

  **类型**: `boolean`

  **默认值**: `false`

  此选项允许完全绕过重新加载循环保护，即使之前已经发生过重新加载，
  也在之前指定的 TTL 时间内强制进行重新加载。

- `persistState`（可选）

  **类型**: `boolean`

  **默认值**: `false`

  是否将当前 Nuxt state 写入 sessionStorage（作为 `nuxt:reload:state`）。默认情况下，除非同时设置 `experimental.restoreState`，或者您自己处理状态恢复，否则
  不会对重新加载产生任何影响。
