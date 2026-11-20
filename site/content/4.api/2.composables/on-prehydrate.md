---
title: onPrehydrate
description: 使用 onPrehydrate 在 Nuxt  hydration 页面之前立即在客户端运行回调函数。
minimalVersion: "3.12"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

::important
此组合式函数在 Nuxt v3.12+ 中可用。
::

`onPrehydrate` 是一个组合式函数生命周期钩子，允许你在 Nuxt  hydration 页面之前立即在客户端运行回调函数。
::note
这是一个高级工具，使用时需谨慎。例如，[`nuxt-time`](https://github.com/danielroe/nuxt-time/pull/251) 和 [`@nuxtjs/color-mode`](https://github.com/nuxt-modules/color-mode/blob/main/src/script.js) 会操作 DOM 以避免 hydration 不匹配。
::

## 使用方式

在 Vue 组件的 setup 函数中调用 `onPrehydrate`（例如在 `<script setup>` 中）或在一个插件中调用。仅在服务器上调用时才会生效，并且会被从客户端构建中移除。但你传递的回调函数会被序列化并嵌入到 HTML 中，因此它在 **浏览器** 中会在 Nuxt hydration 之前立即运行。这意味着它可以访问 `window` 和 DOM 等浏览器全局对象。

## 类型

```ts [Signature]
export function onPrehydrate (callback: (el: HTMLElement) => void): void
export function onPrehydrate (callback: string | ((el: HTMLElement) => void), key?: string): undefined | string
```

## 参数

| 参数 | 类型 | 必填 | 描述 |
| ---- | --- | --- | --- |
| `callback` | `((el: HTMLElement) => void) \| string` | 是 | 一个在 Nuxt hydration 之前运行的函数（或字符串化函数）。它会被字符串化并嵌入到 HTML 中。不应包含外部依赖或回调外的引用变量。在 Nuxt 运行时初始化之前运行，因此不应依赖 Nuxt 或 Vue 上下文。 |
| `key` | `string` | 否 | （高级）用于识别 prehydrate 脚本的唯一键，适用于多个根节点等高级场景。 |

## 返回值

- 当仅提供回调函数时，返回 `undefined`。
- 当提供回调和键时，返回字符串（prehydrate id），可用于设置或访问 `data-prehydrate-id` 属性以进行高级使用。

## 示例

```vue twoslash [app/app.vue]
<script setup lang="ts">
declare const window: Window
// ---cut---
onPrehydrate(() => {
  // Runs in the browser, right before Nuxt hydrates
  console.log(window)
})

// Access the root element
onPrehydrate((el) => {
  console.log(el.outerHTML)
  // <div data-v-inspector="app.vue:15:3" data-prehydrate-id=":b3qlvSiBeH:"> Hi there </div>
})

// Advanced: access/set `data-prehydrate-id` yourself
const prehydrateId = onPrehydrate((el) => {})
</script>

<template>
  <div>
    Hi there
  </div>
</template>
```

在底层，回调函数在构建时被字符串化和压缩，然后作为 `<script>` 标签嵌入到服务器渲染的 HTML 中，就在 `</body>` 标签之前。对于上面的示例，渲染的 HTML 中包含类似以下内容：

```html
<div data-prehydrate-id=":b3qlvSiBeH:"> Hi there </div>
<script>(()=>{console.log(window)})()</script>
<script>document.querySelectorAll('[data-prehydrate-id*=":b3qlvSiBeH:"]').forEach(el=>{console.log(el.outerHTML)})</script>
```

当回调函数接受 `el` 参数时，组件的根元素会添加 `data-prehydrate-id` 属性，以便嵌入的脚本能够找到它。
