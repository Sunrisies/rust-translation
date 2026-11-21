---
title: usePreviewMode
description: 使用 usePreviewMode 来检查和控制 Nuxt 中的预览模式
minimalVersion: "3.11"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/preview.ts
    size: xs
---

# `usePreviewMode`

预览模式允许你查看你的更改在实时网站上的显示效果，而不会向用户展示这些更改。

你可以使用内置的 `usePreviewMode` 组合式函数来访问和控制 Nuxt 中的预览状态。如果该组合式函数检测到预览模式，它会自动强制进行必要的更新，以便 [`useAsyncData`](/docs/api/组合式函数/use-async-data) 和 [`useFetch`](/docs/api/组合式函数/use-fetch) 重新渲染预览内容。

```ts
const { enabled, state } = usePreviewMode()
```

## 选项

### 自定义 `enable` 检查

你可以指定一种自定义方式来启用预览模式。默认情况下，如果 URL 中的 `preview` 参数等于 `true`，`usePreviewMode` 组合式函数将启用预览模式（例如，`http://localhost:3000?preview=true`）。你可以将 `usePreviewMode` 封装到自定义组合式函数中，以确保不同使用场景下的选项一致，并避免任何错误。

```ts
export function useMyPreviewMode () {
  const route = useRoute()
  return usePreviewMode({
    shouldEnable: () => {
      return !!route.query.customPreview
    },
  })
}
```

### 修改默认状态

`usePreviewMode` 会尝试将 URL 中的 `token` 参数的值存储在状态中。你可以修改此状态，它将在所有 [`usePreviewMode`](/docs/api/组合式函数/use-preview-mode) 调用中可用。

```ts
const data1 = ref('data1')

const { enabled, state } = usePreviewMode({
  getState: (currentState) => {
    return { data1, data2: 'data2' }
  },
})
```

::note
`getState` 函数会将返回的值追加到当前状态中，因此请注意不要意外覆盖重要的状态。
::

### 自定义 `onEnable` 和 `onDisable` 回调

默认情况下，当 `usePreviewMode` 被启用时，它会调用 `refreshNuxtData()` 从服务器重新获取所有数据。

当预览模式被禁用时，组合式函数会附加一个回调，在后续路由导航后调用 `refreshNuxtData()`。

你可以为 `onEnable` 和 `onDisable` 选项提供自己的函数，以指定由自定义回调触发。

```ts
const { enabled, state } = usePreviewMode({
  onEnable: () => {
    console.log('preview mode has been enabled')
  },
  onDisable: () => {
    console.log('preview mode has been disabled')
  },
})
```

## 示例

下面的示例创建了一个页面，其中部分内容仅在预览模式下显示。

```vue [app/pages/some-page.vue]
<script setup>
const { enabled, state } = usePreviewMode()

const { data } = await useFetch('/api/preview', {
  query: {
    apiKey: state.token,
  },
})
</script>

<template>
  <div>
    Some base content
    <p v-if="enabled">
      Only preview content: {{ state.token }}
      <br>
      <button @click="enabled = false">
        disable preview mode
      </button>
    </p>
  </div>
</template>
```

现在你可以生成你的网站并提供服务：

```bash [Terminal]
npx nuxt generate
npx nuxt preview
```

然后，你可以通过在想要查看的页面末尾添加查询参数 `preview` 来查看预览页面，例如 `http://localhost:3000/?preview=true`。

::note
应在本地使用 `nuxt generate` 和 `nuxt preview` 进行测试，而不是使用 `nuxt dev`。`[预览命令](/docs/api/commands/preview) 与预览模式无关。
::
