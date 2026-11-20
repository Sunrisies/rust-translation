---
title: useRuntimeHook
description: 在 Nuxt 应用中注册一个运行时钩子，并确保当作用域被销毁时该钩子能被正确释放。
minimalVersion: "3.14"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/runtime-hook.ts
    size: xs
---

::important
此组合式函数适用于 Nuxt v3.14+ 版本。
::

```ts [Signature]
function useRuntimeHook<THookName extends keyof RuntimeNuxtHooks> (
  name: THookName,
  fn: RuntimeNuxtHooks[THookName] extends HookCallback ? RuntimeNuxtHooks[THookName] : never,
): void
```

## 使用方式

### 参数

- `name`: 要注册的运行时钩子的名称。您可以在 [运行时 Nuxt 钩子列表](/docs/api/advanced/hooks#app-hooks-runtime)中查看完整列表。
- `fn`: 在触发钩子时执行的回调函数。函数签名根据钩子名称的不同而不同。

### 返回值

该组合式函数不返回任何值，但在组件作用域被销毁时会自动取消注册该钩子。

## 示例

```vue twoslash [pages/index.vue]
<script setup lang="ts">
// Register a hook that runs every time a link is prefetched, but which will be
// automatically cleaned up (and not called again) when the component is unmounted
useRuntimeHook('link:prefetch', (link) => {
  console.log('Prefetching', link)
})
</script>
```
