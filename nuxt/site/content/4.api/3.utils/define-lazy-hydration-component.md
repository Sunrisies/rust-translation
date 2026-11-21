---
title: defineLazyHydrationComponent
description: 定义一个具有特定策略的懒加载组合式函数。
minimalVersion: "3.18"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyHydrationComponent` 是一个编译器宏，可帮助你创建采用特定懒加载策略的组件。懒加载策略将水合操作延迟到组件可见或浏览器完成关键任务时再执行。这可以显著降低初始性能开销，尤其适用于非必要的组件。

## 使用方式

### 可见性策略

在组件在视口中可见时执行水合操作。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'visible',
  () => import('./components/MyComponent.vue'),
)
</script>

<template>
  <div>
    <!--
      Hydration will be triggered when
      the element(s) is 100px away from entering the viewport.
    -->
    <LazyHydrationMyComponent :hydrate-on-visible="{ rootMargin: '100px' }" />
  </div>
</template>
```

`hydrateOnVisible` 属性是可选的。你可以传递一个对象来定制 `IntersectionObserver` 的行为。

::read-more{to="https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver" title="IntersectionObserver options"}
了解更多关于 `hydrate-on-visible` 选项的信息。
::

::note
实际上，这是使用 Vue 内置的 [`hydrateOnVisible` 策略](https://vuejs.org/guide/components/async#hydrate-on-visible)。
::

### 空闲策略

在浏览器处于空闲状态时执行水合操作。适用于需要组件尽快加载但不阻塞关键渲染路径的情况。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'idle',
  () => import('./components/MyComponent.vue'),
)
</script>

<template>
  <div>
    <!-- Hydration will be triggered when the browser is idle or after 2000ms. -->
    <LazyHydrationMyComponent :hydrate-on-idle="2000" />
  </div>
</template>
```

`hydrateOnIdle` 属性是可选的。你可以传递一个正数来指定最大超时时间。

空闲策略适用于在浏览器空闲时可以进行水合的组件。

::note
实际上，这是使用 Vue 内置的 [`hydrateOnIdle` 策略](https://vuejs.org/guide/components/async#hydrate-on-idle)。
::

### 交互策略

在指定交互发生后（例如点击、鼠标悬停）执行水合操作。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'interaction',
  () => import('./components/MyComponent.vue'),
)
</script>

<template>
  <div>
    <!--
      Hydration will be triggered when
      the element(s) is hovered over by the pointer.
    -->
    <LazyHydrationMyComponent hydrate-on-interaction="mouseover" />
  </div>
</template>
```

`hydrateOnInteraction` 属性是可选的。如果你不传递事件或事件列表，则默认在 `pointerenter`、`click` 和 `focus` 时执行水合。

::note
实际上，这是使用 Vue 内置的 [`hydrateOnInteraction` 策略](https://vuejs.org/guide/components/async#hydrate-on-interaction)。
::

### 媒体查询策略

当窗口符合媒体查询条件时执行水合操作。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'mediaQuery',
  () => import('./components/MyComponent.vue'),
)
</script>

<template>
  <div>
    <!--
      Hydration will be triggered when
      the window width is greater than or equal to 768px.
    -->
    <LazyHydrationMyComponent hydrate-on-media-query="(min-width: 768px)" />
  </div>
</template>
```

::note
实际上，这是使用 Vue 内置的 [`hydrateOnMediaQuery` 策略](https://vuejs.org/guide/components/async#hydrate-on-media-query)。
::

### 时间策略

在指定延迟时间（以毫秒为单位）后执行水合操作。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'time',
  () => import('./components/MyComponent.vue'),
)
</script>

<template>
  <div>
    <!-- Hydration is triggered after 1000ms. -->
    <LazyHydrationMyComponent :hydrate-after="1000" />
  </div>
</template>
```

时间策略适用于可以等待特定时间的组件。

### 条件策略

根据布尔条件执行水合操作。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'if',
  () => import('./components/MyComponent.vue'),
)

const isReady = ref(false)

function myFunction () {
  // Trigger custom hydration strategy...
  isReady.value = true
}
</script>

<template>
  <div>
    <!-- Hydration is triggered when isReady becomes true. -->
    <LazyHydrationMyComponent :hydrate-when="isReady" />
  </div>
</template>
```

条件策略最适合那些可能不总是需要水合的组件。

### 永远不要进行 hydration

永远不对该组件进行 hydration。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'never',
  () => import('./components/MyComponent.vue'),
)
</script>

<template>
  <div>
    <!-- This component will never be hydrated by Vue. -->
    <LazyHydrationMyComponent />
  </div>
</template>
```

### 监听 hydration 事件

所有延迟 hydration 的组件在完成 hydration 后会触发 `@hydrated` 事件。

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'visible',
  () => import('./components/MyComponent.vue'),
)

function onHydrate () {
  console.log('Component has been hydrated!')
}
</script>

<template>
  <div>
    <LazyHydrationMyComponent
      :hydrate-on-visible="{ rootMargin: '100px' }"
      @hydrated="onHydrated"
    />
  </div>
</template>
```

## 参数

::warning
为确保编译器正确识别此宏，避免使用外部变量。以下方法可防止宏被正确识别：

```vue
<script setup lang="ts">
const strategy = 'visible'
const source = () => import('./components/MyComponent.vue')
const LazyHydrationMyComponent = defineLazyHydrationComponent(strategy, source)
</script>
```
::

### `strategy`

- **类型**: `'visible' | 'idle' | 'interaction' | 'mediaQuery' | 'if' | 'time' | 'never'`
- **必需**: `true`

| Strategy      | 描述                                                    |
|---------------|----------------------------------------------------------------|
| `visible`     | 在组件在视口中可见时进行 hydration。                       |
| `idle`        | 在浏览器处于空闲状态或经过延迟后进行 hydration。            |
| `interaction` | 在用户交互时（例如点击、悬停）进行 hydration。                |
| `mediaQuery`  | 当满足指定的媒体查询条件时进行 hydration。                    |
| `if`          | 当满足指定的布尔条件时进行 hydration。                        |
| `time`        | 在指定时间延迟后进行 hydration。                            |
| `never`       | 阻止 Vue 对该组件进行 hydration。                           |

### `source`

- **类型**: `() => Promise<Component>`
- **必需**: `true`
