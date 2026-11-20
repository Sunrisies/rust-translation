---
title: useHeadSafe
description: 提供用户输入的头数据的最佳方式。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

## 使用方式

`useHeadSafe` 组合式函数是一个围绕 [`useHead`](/docs/api/组合式函数/use-head) 组合式函数的包装器，它仅允许使用安全值。这是处理用户输入时管理头数据的推荐方法，因为它通过清理潜在的危险属性来防止 XSS 攻击。

::warning
使用 `useHeadSafe` 时，脚本中的 `innerHTML` 或元标签中的 `http-equiv` 等潜在危险属性会自动被移除，以防止 XSS 攻击。当处理用户生成的内容时，请始终使用此组合式函数。
::

## 类型

```ts [Signature]
export function useHeadSafe (input: MaybeComputedRef<HeadSafe>): void
```

### 允许的属性

以下属性针对每种头元素类型被列入白名单：

```ts
const WhitelistAttributes = {
  htmlAttrs: ['class', 'style', 'lang', 'dir'],
  bodyAttrs: ['class', 'style'],
  meta: ['name', 'property', 'charset', 'content', 'media'],
  noscript: ['textContent'],
  style: ['media', 'textContent', 'nonce', 'title', 'blocking'],
  script: ['type', 'textContent', 'nonce', 'blocking'],
  link: ['color', 'crossorigin', 'fetchpriority', 'href', 'hreflang', 'imagesrcset', 'imagesizes', 'integrity', 'media', 'referrerpolicy', 'rel', 'sizes', 'type'],
}
```

更多详细类型信息，请参阅 [@unhead/vue](https://github.com/unjs/unhead/blob/main/packages/vue/src/types/safeSchema.ts)。

## 参数

`input`: 一个包含头数据的 `MaybeComputedRef<HeadSafe>` 对象。你可以传递与 [`useHead`](/docs/api/组合式函数/use-head) 相同的值，但只有安全属性会被渲染。

## 返回值

此组合式函数不返回任何值。

## 示例

```vue [app/pages/user-profile.vue]
<script setup lang="ts">
// User-generated content that might contain malicious code
const userBio = ref('<script>alert("xss")<' + '/script>')

useHeadSafe({
  title: `User Profile`,
  meta: [
    {
      name: 'description',
      content: userBio.value, // Safely sanitized
    },
  ],
})
</script>
```

::read-more{to="https://unhead.unjs.io/docs/typescript/head/api/composables/use-head-safe" target="_blank"}
更多内容请参阅 `Unhead` 文档。
::
