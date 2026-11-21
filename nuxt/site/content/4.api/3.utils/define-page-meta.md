---
title: definePageMeta
description: 为位于 [`app/pages/`](/docs/directory-structure/app/pages) 目录中的 **页面** 组件定义元数据。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/pages/runtime/composables.ts
    size: xs
---

`definePageMeta` 是一个编译器宏，您可以使用它为 Nuxt 应用程序中的静态或动态路由的页面组件设置元数据（除非[另有指定](/docs/api/nuxt-config#pages)）。这样，您可以为每个静态或动态路由设置自定义元数据。

```vue [app/pages/some-page.vue]
<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
</script>
```

:read-more{to="/docs/directory-structure/app/pages#page-metadata"}

## 类型

```ts [Signature]
export function definePageMeta (meta: PageMeta): void

interface PageMeta {
  validate?: ((route: RouteLocationNormalized) => boolean | Promise<boolean> | Partial<NuxtError> | Promise<Partial<NuxtError>>)
  redirect?: RouteRecordRedirectOption
  name?: string
  path?: string
  props?: RouteRecordRaw['props']
  alias?: string | string[]
  groups?: string[]
  pageTransition?: boolean | TransitionProps
  layoutTransition?: boolean | TransitionProps
  viewTransition?: ViewTransitionPageOptions['enabled'] | ViewTransitionPageOptions
  key?: false | string | ((route: RouteLocationNormalizedLoaded) => string)
  keepalive?: boolean | KeepAliveProps
  layout?: false | LayoutKey | Ref<LayoutKey> | ComputedRef<LayoutKey> | { name?: LayoutKey | false, props?: Record<string, unknown> /* or the selected layout's props */ }
  middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>
  scrollToTop?: boolean | ((to: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded) => boolean)
  [key: string]: unknown
}
```

## 参数

### `meta`

- **类型**: `PageMeta`

  一个对象，接受以下页面元数据：

  **`name`**

  - **类型**: `string`

    您可以定义此页面路由的名称。默认情况下，名称基于 [`app/pages/` 目录](/docs/directory-structure/app/pages) 中的路径生成。

  **`path`**

  - **类型**: `string`

    如果您需要更复杂的模式而文件名无法表达，可以定义[自定义正则表达式](/docs/api/utils/define-page-meta#using-a-custom-regular-expression)。

  **`props`**
  
  - **类型**: [`RouteRecordRaw['props']`](https://router.vuejs.org/guide/essentials/passing-props)

    允许将路由 `params` 作为传递给页面组件的 props 访问。

  **`alias`**

  - **类型**: `string | string[]`

    记录的别名。允许定义额外的路径，使其行为类似于记录本身。允许使用类似 `/users/:id` 和 `/u/:id` 的路径简写。所有 `alias` 和 `path` 值必须共享相同的 params。

  **`groups`** :badge[v4.3]{color="info" size="xs" class="align-middle"}

  - **类型**: `string[]`

    根据文件夹结构，指定页面所属的路由组。对于位于 [路由组](/docs/directory-structure/app/pages#route-groups) 中的页面，会自动填充这些组。

  **`keepalive`**

  - **类型**: `boolean` | [`KeepAliveProps`](https://vuejs.org/api/built-in-components#keepalive)

    当您希望在路由变化时保留页面状态或需要细粒度控制时，将值设置为 `true`。

  **`key`**

  - **类型**: `false` | `string` | `((route: RouteLocationNormalizedLoaded) => string)`

    当您需要更精确地控制 `<NuxtPage>` 组件何时重新渲染时，设置 `key` 值。

  **`layout`**

  - **类型**: `false` | `LayoutKey` | `Ref<LayoutKey>` | `ComputedRef<LayoutKey>` | `{ name?: LayoutKey | false; props?: Record<string, unknown> /* 或所选布局的 props */ }`

    为每个路由设置布局的静态或动态名称。如果需要禁用默认布局，可设置为 `false`。

    您还可以传递一个包含 `name` 和 `props` 的对象，以将类型化的 props 传递给布局组件。当您的布局使用 `defineProps` 定义 props 时，这些 props 将在 `definePageMeta` 中完全被类型化。

  **`layoutTransition`**

  - **类型**: `boolean` | [`TransitionProps`](https://vuejs.org/api/built-in-components#transition)

    设置当前布局适用的过渡名称。您也可以将此值设置为 `false` 以禁用布局过渡。

  **`middleware`**

  - **类型**: `MiddlewareKey` | [`NavigationGuard`](https://router.vuejs.org/api/interfaces/navigationguard) | `Array<MiddlewareKey | NavigationGuard>`

    直接在 `definePageMeta` 中定义匿名或命名的中间件。更多关于[路由中间件](/docs/directory-structure/app/中间件)的信息，请参考相关文档。

  **`pageTransition`**

  - **类型**: `boolean` | [`TransitionProps`](https://vuejs.org/api/built-in-components#transition)

    设置当前页面适用的过渡名称。您也可以将此值设置为 `false` 以禁用页面过渡。

  **`viewTransition`**

  - **类型**: `boolean | 'always' | ViewTransitionPageOptions`

    这是一个实验性功能，仅在[在 nuxt.config 文件中启用](/docs/getting-started/transitions#view-transitions-api-experimental)时可用。
    启用/禁用当前页面的视图过渡。
    如果设置为 `true`，当用户浏览器符合 `prefers-reduced-motion: reduce` 设置时（推荐），Nuxt 将不会应用过渡效果。如果设置为 `always`，Nuxt 将始终应用过渡效果。

    您还可以传递一个 `ViewTransitionPageOptions` 对象来配置[视图过渡类型](/docs/getting-started/transitions#view-transition-types)：
    - `enabled`: `boolean | 'always'` - 启用/禁用过渡
    - `types`: `string[] | (to, from) => string[]` - 应用于涉及此页面的所有过渡的类型
    - `toTypes`: `string[] | (to, from) => string[]` - 仅在**导航到**此页面时应用的类型
    - `fromTypes`: `string[] | (to, from) => string[]` - 仅在**从**此页面导航时应用的类型

  **`redirect`**

  - **类型**: [`RouteRecordRedirectOption`](https://router.vuejs.org/guide/essentials/redirect-and-alias)

    当路由直接匹配时，重定向发生的位置。重定向在导航保护之前进行，并触发带有新目标位置的新的导航。

  **`validate`**

  - **类型**: `(route: RouteLocationNormalized) => boolean | Promise<boolean> | Partial<NuxtError> | Promise<Partial<NuxtError>>`

    验证给定路由是否可以通过此页面正确渲染。如果有效则返回 true，否则返回 false。如果找不到其他匹配项，则表示 404 错误。您也可以直接返回一个包含 `status`/`statusText` 的对象，以立即响应错误（此时不会检查其他匹配项）。

  **`scrollToTop`**

  - **类型**: `boolean | (to: RouteLocationNormalized, from: RouteLocationNormalized) => boolean`

    告诉 Nuxt 在渲染页面之前是否滚动到顶部。导航与渲染是独立的，因此即使页面没有重新渲染，也会触发滚动行为（例如使用固定的 [`key`](/docs/api/utils/define-page-meta#key)）。设置 `scrollToTop: false` 可以禁用滚动。如果您希望覆盖 Nuxt 的默认滚动行为，可以在 `~/router.options.ts` 中实现（更多详情请参见 [自定义路由](/docs/guide/recipes/custom-routing#using-routeroptions)）。

  **`[key: string]`**

  - **类型**: `any`

    除了上述属性外，您还可以设置**自定义**元数据。您可以通过[增强 `meta` 对象的类型](/docs/directory-structure/app/pages/#typing-custom-metadata)以类型安全的方式实现此功能。

## 示例

### 基本用法

下面的示例展示了：

- `key` 如何是一个返回值的函数；
- `keepalive` 属性如何确保在切换多个组件时 `<modal>` 组件不会被缓存；
- 如何将 `pageType` 作为自定义属性添加：

```vue [app/pages/some-page.vue]
<script setup lang="ts">
definePageMeta({
  key: route => route.fullPath,

  keepalive: {
    exclude: ['modal'],
  },

  pageType: 'Checkout',
})
</script>
```

### 定义中间件

下面的示例展示了如何使用 `function` 直接在 `definePageMeta` 中定义中间件，或将其设置为与 `app/middleware/` 目录中的中间件文件名匹配的字符串：

```vue [app/pages/some-page.vue]
<script setup lang="ts">
definePageMeta({
  // define middleware as a function
  middleware: [
    function (to, from) {
      const auth = useState('auth')

      if (!auth.value.authenticated) {
        return navigateTo('/login')
      }

      if (to.path !== '/checkout') {
        return navigateTo('/checkout')
      }
    },
  ],

  // ... or a string
  middleware: 'auth',

  // ... or multiple strings
  middleware: ['auth', 'another-named-middleware'],
})
</script>
```

### 使用自定义正则表达式

自定义正则表达式是解决重叠路由冲突的好方法，例如：

两个路由 "/test-category" 和 "/1234-post" 与 `[postId]-[postSlug].vue` 和 `[categorySlug].vue` 页面路由匹配。

为了确保在 `[postId]-[postSlug]` 路由中 `postId` 只匹配数字（`\d+`），可以在 `[postId]-[postSlug].vue` 页面模板中添加以下内容：

```vue [app/pages/[postId\\]-[postSlug\\].vue]
<script setup lang="ts">
definePageMeta({
  path: '/:postId(\\d+)-:postSlug',
})
</script>
```

更多示例请参见 [Vue Router 的匹配语法](https://router.vuejs.org/guide/essentials/route-matching-syntax)。

### 定义布局

你可以定义与布局文件名相匹配的布局，该文件默认位于 [`app/layouts/` 目录](/docs/directory-structure/app/layouts) 中。你也可以将 `layout` 设置为 `false` 来禁用该布局：

```vue [app/pages/some-page.vue]
<script setup lang="ts">
definePageMeta({
  // set custom layout
  layout: 'admin',

  // ... or disable a default layout
  layout: false,
})
</script>
```

### 向布局传递属性

你可以使用对象语法为 `layout` 传递属性给布局。如果你的布局使用 `defineProps` 定义属性，这些属性将会完全具有类型检查功能。

::code-group

```vue [app/pages/dashboard.vue]
<script setup lang="ts">
definePageMeta({
  layout: {
    name: 'panel',
    props: {
      sidebar: true,
      title: 'Dashboard',
    },
  },
})
</script>
```

```vue [app/layouts/panel.vue]
<script setup lang="ts">
const props = defineProps<{
  sidebar?: boolean
  title?: string
}>()
</script>

<template>
  <div>
    <aside v-if="sidebar">
      Sidebar
    </aside>
    <main>
      <h1>{{ title }}</h1>
      <slot />
    </main>
  </div>
</template>
```

::

::tip
通过 `definePageMeta` 设置的布局属性基于布局的 `defineProps` 完全具有类型检查功能。在编辑器中你将获得自动补全和类型检查功能。
::

:read-more{to="/docs/directory-structure/app/layouts#passing-props-to-layouts"}
