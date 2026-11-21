---
title: defineNuxtPlugin
description: defineNuxtPlugin() 是一个用于创建 Nuxt 插件的辅助函数。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/nuxt.ts
    size: xs
---

`defineNuxtPlugin` 是一个用于创建具有增强功能和类型安全的 Nuxt 插件的辅助函数。此工具将不同的插件格式标准化为一致的结构，使其能够在 Nuxt 的插件系统中无缝运行。

```ts twoslash [plugins/hello.ts]
export default defineNuxtPlugin((nuxtApp) => {
  // Doing something with nuxtApp
})
```

:read-more{to="/docs/directory-structure/app/plugins#creating-plugins"}

## 类型

```ts [Signature]
export function defineNuxtPlugin<T extends Record<string, unknown>> (plugin: Plugin<T> | ObjectPlugin<T>): Plugin<T> & ObjectPlugin<T>

type Plugin<T> = (nuxt: NuxtApp) => Promise<void> | Promise<{ provide?: T }> | void | { provide?: T }

interface ObjectPlugin<T> {
  name?: string
  enforce?: 'pre' | 'default' | 'post'
  dependsOn?: string[]
  order?: number
  parallel?: boolean
  setup?: Plugin<T>
  hooks?: Partial<RuntimeNuxtHooks>
  env?: {
    islands?: boolean
  }
}
```

## 参数

**plugin**: 插件可以通过两种方式定义：
1. **函数插件**：一个接收 [`NuxtApp`](/docs/guide/going-further/internals#the-nuxtapp-interface) 实例的函数，该函数可以返回一个包含具有 [`provide`](/docs/directory-structure/app/plugins#providing-helpers) 属性的对象的 Promise，以便在 [`NuxtApp`](/docs/guide/going-further/internals#the-nuxtapp-interface) 实例上提供辅助功能。
2. **对象插件**：一个包含多种属性的对象，用于配置插件的行为，如 `name`、`enforce`、`dependsOn`、`order`、`parallel`、`setup`、`hooks` 和 `env`。

| 属性    | 类型                                   | 是否必需 | 描述                                                                                                                                                         |
|-------------|----------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`      | `string`                               | `false`  | 插件的可选名称，有助于调试和依赖管理。                                                                                       |
| `enforce`   | `'pre'` \| `'default'` \| `'post'`     | `false`  | 控制插件相对于其他插件运行的时间。                                                                                                            |
| `dependsOn` | `string[]`                             | `false`  | 该插件所依赖的插件名称数组。确保正确的执行顺序。                                                                                       |
| `order`     | `number`                               | `false`  | 允许对插件顺序进行更精细的控制，仅由高级用户使用。**它会覆盖 `enforce` 的值，用于排序插件。** |
| `parallel`  | `boolean`                              | `false`  | 是否与其他并行插件并行执行该插件。                                                                                              |
| `setup`     | `Plugin<T>`{lang="ts"}                 | `false`  | 主插件函数，相当于函数插件。                                                                                                          |
| `hooks`     | `Partial<RuntimeNuxtHooks>`{lang="ts"} | `false`  | 可直接注册 Nuxt 应用运行时钩子。                                                                                                                        |
| `env`       | `{ islands?: boolean }`{lang="ts"}     | `false`  | 如果不想在仅服务器或独立组件渲染时运行插件，请将此值设置为 `false`。                                                      |

:video-accordion{title="Watch a video from Alexander Lichter about the Object Syntax for Nuxt plugins" videoId="2aXZyXB1QGQ"}

## 示例

### 基本用法

以下示例展示了一个简单的插件，该插件添加了全局功能：

```ts twoslash [plugins/hello.ts]
export default defineNuxtPlugin((nuxtApp) => {
  // Add a global method
  return {
    provide: {
      hello: (name: string) => `Hello ${name}!`,
    },
  }
})
```

### 对象语法插件

以下示例展示了带有高级配置的对象语法：

```ts twoslash [plugins/advanced.ts]
export default defineNuxtPlugin({
  name: 'my-plugin',
  enforce: 'pre',
  async setup (nuxtApp) {
    // Plugin setup logic
    const data = await $fetch('/api/config')

    return {
      provide: {
        config: data,
      },
    }
  },
  hooks: {
    'app:created' () {
      console.log('App created!')
    },
  },
})
```
