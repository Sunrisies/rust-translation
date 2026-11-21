---
title: useAnnouncer
description: 一个用于向屏幕阅读器宣布消息的组合式函数。
minimalVersion: "4.4"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/announcer.ts
    size: xs
---

::important
此组合式函数在 Nuxt v4.4.2+ 中可用。
::

## 描述

一个用于向屏幕阅读器宣布动态内容变化的函数。与自动宣布路由变化的 [`useRouteAnnouncer`](/docs/api/组合式函数/use-route-announcer) 不同，`useAnnouncer` 允许你手动控制要宣布什么以及何时宣布。

适用于页面内更新，如表单验证、异步操作、提示通知和实时内容变化。

## 参数

- `politeness`: 设置屏幕阅读器宣布的默认紧急程度：`off`（禁用宣布）、`polite`（等待静默）或 `assertive`（立即中断）。（默认值为 `polite`）

## 属性

### `message`

- **type**: `Ref<string>`
- **description**: 当前要宣布的消息

### `politeness`

- **type**: `Ref<'polite' | 'assertive' | 'off'>`
- **description**: 屏幕阅读器宣布的紧急程度

## 方法

### `set(message, politeness = "polite")`

设置要宣布的消息及其紧急程度。

### `polite(message)`

将消息设置为 `politeness = "polite"`。适用于可以等待屏幕阅读器完成当前任务的非紧急更新。

### `assertive(message)`

将消息设置为 `politeness = "assertive"`。适用于应立即中断屏幕阅读器的紧急更新。

## 示例

```vue [app/pages/contact.vue]
<script setup lang="ts">
const { polite, assertive } = useAnnouncer()

async function submitForm () {
  try {
    await $fetch('/api/contact', { method: 'POST', body: formData })
    polite('Message sent successfully')
  } catch (error) {
    assertive('Error: Failed to send message')
  }
}
</script>
```

## 使用场景

### 表单验证

```vue [app/components/LoginForm.vue]
<script setup lang="ts">
const { assertive } = useAnnouncer()

function validateForm () {
  const errors = []
  if (!email.value) { errors.push('Email is required') }
  if (!password.value) { errors.push('Password is required') }

  if (errors.length) {
    assertive(`Form has ${errors.length} errors: ${errors.join(', ')}`)
    return false
  }
  return true
}
</script>
```

### 加载状态

```vue [app/pages/dashboard.vue]
<script setup lang="ts">
const { polite } = useAnnouncer()

const { data, status } = await useFetch('/api/data')

watch(status, (newStatus) => {
  if (newStatus === 'pending') {
    polite('Loading data...')
  } else if (newStatus === 'success') {
    polite('Data loaded successfully')
  }
})
</script>
```

### 搜索结果

```vue [app/components/Search.vue]
<script setup lang="ts">
const { polite } = useAnnouncer()

const results = ref([])

watch(results, (newResults) => {
  polite(`Found ${newResults.length} results`)
})
</script>
```

::callout
你需要在应用中添加 [`<NuxtAnnouncer>`](/docs/api/components/nuxt-announcer) 组件，以便宣布内容在 DOM 中显示。
::

::callout
对于路由/页面变化的自动宣布，应使用 [`useRouteAnnouncer`](/docs/api/组合式函数/use-route-announcer) 并结合 [`<NuxtRouteAnnouncer>`](/docs/api/components/nuxt-route-announcer) 组件。
::
