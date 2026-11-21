---
title: useLoadingIndicator
description: 此组合式函数可让你访问应用页面的加载状态。
minimalVersion: "3.9"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/loading-indicator.ts
    size: xs
---

## 描述

这是一个返回页面加载状态的组合式函数。被 [`<NuxtLoadingIndicator>`](/docs/api/components/nuxt-loading-indicator) 使用，并且可以控制。
它通过 [`page:loading:start`](/docs/api/advanced/hooks#app-hooks-runtime) 和 [`page:loading:end`](/docs/api/advanced/hooks#app-hooks-runtime) 钩子来改变其状态。

## 参数

- `duration`: 加载条持续时间，以毫秒为单位（默认 `2000`）。
- `throttle`: 显示和隐藏的延迟时间，以毫秒为单位（默认 `200`）。
- `estimatedProgress`: 默认情况下，Nuxt 在接近 100% 时会暂停更新。你可以提供一个自定义函数来自定义进度估计值，该函数接收加载条持续时间及经过的时间，并应返回 0 到 100 之间的数值。

## 属性

### `isLoading`

- **类型**: `Readonly<ShallowRef<boolean>>`
- **描述**: 加载状态

### `error`

- **类型**: `Readonly<ShallowRef<boolean>>`
- **描述**: 错误状态

### `progress`

- **类型**: `Readonly<ShallowRef<number>>`
- **描述**: 进度状态，范围为 `0` 到 `100`。

## 方法

### `start()`

将 `isLoading` 设置为 `true`，并开始增加 `progress` 值。`start` 接受 `{ force: true }` 选项，可跳过间隔并立即显示加载状态。

### `set()`

将 `progress` 值设置为特定值。`set` 接受 `{ force: true }` 选项，可跳过间隔并立即显示加载状态。

### `finish()`

将 `progress` 值设置为 `100`，停止所有计时器和间隔，然后在 `500` 毫秒后重置加载状态。`finish` 接受 `{ force: true }` 选项，可在状态重置前跳过间隔；接受 `{ error: true }` 可改变加载条颜色并将错误属性设置为 `true`。

### `clear()`

由 `finish()` 使用。清除组合式函数使用的所有计时器和间隔。

## 示例

```vue
<script setup lang="ts">
const { progress, isLoading, start, finish, clear } = useLoadingIndicator({
  duration: 2000,
  throttle: 200,
  // This is how progress is calculated by default
  estimatedProgress: (duration, elapsed) => (2 / Math.PI * 100) * Math.atan(elapsed / duration * 100 / 50),
})
</script>
```

```vue
<script setup lang="ts">
const { start, set } = useLoadingIndicator()
// same as set(0, { force: true })
// set the progress to 0, and show loading immediately
start({ force: true })
</script>
```
