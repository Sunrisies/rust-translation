---
title: useRouteAnnouncer
description: 此组合式函数会监听页面标题的变化，并相应地更新提示消息。
minimalVersion: "3.12"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/route-announcer.ts
    size: xs
---

::important
此组合式函数在 Nuxt v3.12+ 版本中可用。
::

## 描述

这是一个组合式函数，用于监听页面标题的变化，并相应地更新提示消息。由 [`<NuxtRouteAnnouncer>`](/docs/api/components/nuxt-route-announcer) 使用，并且可以控制。
它通过 Unhead 的 `dom:rendered` 钩子来读取页面标题，并将其设置为提示消息。

:read-more{title="Nuxt accessibility" to="/docs/guide/best-practices/accessibility#route-announcements"}

## 参数

- `politeness`: 设置屏幕阅读器提示的紧急程度：`off`（禁用提示）、`polite`（等待静默）或 `assertive`（立即中断）。（默认值为 `polite`）。

## 属性

### `message`

- **type**: `Ref<string>`
- **description**: 要显示的提示消息

### `politeness`

- **type**: `Ref<string>`
- **description**: 屏幕阅读器提示的紧急程度：`off`、`polite` 或 `assertive`

## 方法

### `set(message, politeness = "polite")`

设置要显示的提示消息及其紧急程度。

### `polite(message)`

以 `politeness = "polite"` 设置提示消息。

### `assertive(message)`

以 `politeness = "assertive"` 设置提示消息。

## 示例

```vue [app/pages/index.vue]
<script setup lang="ts">
const { message, politeness, set, polite, assertive } = useRouteAnnouncer({
  politeness: 'assertive',
})
</script>
```

::callout
对于动态页面内容变化的提示（表单验证、提示信息、加载状态），请使用 [`useAnnouncer`](/docs/api/组合式函数/use-announcer) 代替。
::
