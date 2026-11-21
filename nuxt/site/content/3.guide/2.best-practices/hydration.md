---
navigation.title: 'Nuxt and Hydration'
title: Nuxt 与 hydration 机制
description: 为什么修复 hydration 问题很重要
---

在开发过程中，你可能会遇到 hydration 问题。不要忽视这些警告。

## 为什么修复它们很重要？

Hydration 不匹配不仅仅是警告——它们是严重问题的标志，可能导致你的应用崩溃：

### 性能影响

- **交互响应时间增加**：Hydration 错误会迫使 Vue 重新渲染整个组件树，从而延长 Nuxt 应用变得可交互的时间
- **用户体验不佳**：用户可能会看到内容闪烁或布局异常变化

### 功能问题

- **交互失效**：事件监听器可能无法正确绑定，导致按钮和表单无法使用
- **状态不一致**：应用状态可能与用户看到的画面不一致
- **SEO 问题**：搜索引擎可能索引出与用户实际看到不同的内容

## 如何检测这些问题

### 开发控制台警告

在开发过程中，Vue 会在浏览器控制台中记录 hydration 不匹配的警告：

![Screenshot of Vue hydration mismatch warning in the browser console](/assets/docs/best-practices/vue-console-hydration.png)

## 常见原因

### 服务器环境中使用仅浏览器支持的 API

**问题**：在服务器端渲染时使用仅浏览器支持的 API。

```html
<template>
  <div>User preference: {{ userTheme }}</div>
</template>

<script setup>
// This will cause hydration mismatch!
// localStorage doesn't exist on the server!
const userTheme = localStorage.getItem('theme') || 'light'
</script>
```

**解决方案**：你可以使用 [`useCookie`](/docs/api/组合式函数/use-cookie)：

```html
<template>
  <div>User preference: {{ userTheme }}</div>
</template>

<script setup>
// This works on both server and client
const userTheme = useCookie('theme', { default: () => 'light' })
</script>
```

### 数据不一致

**问题**：服务器和客户端之间的数据不同。

```html
<template>
  <div>{{ Math.random() }}</div>
</template>
```

**解决方案**：使用适合 SSR 的状态管理：

```html
<template>
  <div>{{ state }}</div>
</template>

<script setup>
const state = useState('random', () => Math.random())
</script>
```

### 基于客户端状态的条件渲染

**问题**：在 SSR 过程中使用仅客户端的条件判断。

```html
<template>
  <div v-if="window?.innerWidth > 768">
    Desktop content
  </div>
</template>
```

**解决方案**：使用媒体查询或在客户端处理：

```html
<template>
  <div class="responsive-content">
    <div class="hidden md:block">Desktop content</div>
    <div class="md:hidden">Mobile content</div>
  </div>
</template>
```

### 具有副作用的第三方库

**问题**：修改 DOM 或依赖浏览器的库（标签管理器经常出现这种情况）。

```html
<script setup>
if (import.meta.client) {
    const { default: SomeBrowserLibrary } = await import('browser-only-lib')
    SomeBrowserLibrary.init()
}
</script>
```

**解决方案**：在 hydration 完成后初始化这些库：

```html
<script setup>
onMounted(async () => {
  const { default: SomeBrowserLibrary } = await import('browser-only-lib')
  SomeBrowserLibrary.init()
})
</script>
```

### 基于时间的动态内容

**问题**：根据当前时间变化的内容。

```html
<template>
  <div>{{ greeting }}</div>
</template>

<script setup>
const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : 'Good afternoon'
</script>
```

**解决方案**：使用 [`NuxtTime`](/docs/api/components/nuxt-time) 组件或在客户端处理：

```html
<template>
  <div>
    <NuxtTime :datetime="new Date()" format="HH:mm" />
  </div>
</template>
```

```html
<template>
  <div>
    <ClientOnly>
      {{ greeting }}
      <template #fallback>
        Hello!
      </template>
    </ClientOnly>
  </div>
</template>

<script setup>
const greeting = ref('Hello!')

onMounted(() => {
  const hour = new Date().getHours()
  greeting.value = hour < 12 ? 'Good morning' : 'Good afternoon'
})
</script>
```

### iOS Safari 上的电话号码

**问题**：iOS Safari 会在渲染文本中检测电话号码（以及其他数据如日期、地址和电子邮件地址），并将它们包裹在链接中。这会在 Vue 进行 hydration 之前改变 DOM，导致仅在 iOS 上出现 hydration 不匹配问题。

**解决方案**：在 `nuxt.config` 中添加 `format-detection` meta 标签以禁用检测功能：

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  app: {
    head: {
      meta: [
        { name: 'format-detection', content: 'telephone=no, date=no, email=no, address=no' },
      ],
    },
  },
})
```

为了让电话号码可点击，将其包裹在 `<a href="tel:...">` 元素中，这样链接就会成为服务器渲染的 HTML 的一部分。

## 总结

1. **使用适合 SSR 的组合式函数**：`[useFetch](/docs/api/composables/use-fetch)`、`[useAsyncData](/docs/api/composables/use-async-data)`、`[useState](/docs/api/composables/use-state)`

2. **包裹仅用于客户端的代码**：使用 `[ClientOnly](/docs/api/components/client-only)` 组件来处理浏览器特定的内容

3. **保持数据源一致**：确保服务器和客户端使用相同的数据

4. **避免在 setup 中产生副作用**：将依赖浏览器的代码移动到 `onMounted` 函数中
2. **Wrap client-only code**: Use [`ClientOnly`](/docs/api/components/client-only) component for browser-specific content
3. **Consistent data sources**: Ensure server and client uses the same data
4. **Avoid side effects in setup**: Move browser-dependent code to `onMounted`

::tip
您可以阅读 [Vue 关于 SSR 水合不匹配的文档](https://vuejs.org/guide/scaling-up/ssr#hydration-mismatch)以更好地理解水合过程。
::
