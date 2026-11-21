---
title: useState
description: 该 useState 组合式函数创建一个响应式且适合 SSR 的共享状态。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/state.ts
    size: xs
---

## 使用方式

```ts
// Create a reactive state and set default value
const count = useState('counter', () => Math.round(Math.random() * 100))
```

:read-more{to="/docs/getting-started/state-management"}

::important
由于 `useState` 中的数据会被序列化为 JSON，因此必须确保其中不包含无法序列化的内容，例如类、函数或符号。
::

::warning
`useState` 是编译器转换后的保留函数名，因此不应将自定义函数命名为 `useState`。
::

:video-accordion{title="Watch a video from Alexander Lichter about why and when to use useState" videoId="mv0WcBABcIk"}

## 使用 `shallowRef`

如果不需要状态具有深度响应性，可以将 `useState` 与 [`shallowRef`](https://vuejs.org/api/reactivity-advanced#shallowref) 结合使用。当状态包含大型对象和数组时，这种方法可以提升性能。

```ts
const state = useState('my-shallow-state', () => shallowRef({ deep: 'not reactive' }))
// isShallow(state) === true
```

## 类型

```ts [Signature]
export function useState<T> (init?: () => T | Ref<T>): Ref<T>
export function useState<T> (key: string, init?: () => T | Ref<T>): Ref<T>
```

- `key`: 一个唯一的键，确保数据获取在多个请求中不会重复。如果未提供键，则系统会为 `useState` 的实例生成基于文件和行号的唯一键。
- `init`: 一个函数，用于在未初始化的状态下提供状态初始值。该函数也可以返回 `Ref`。
- `T`:（仅适用于 TypeScript）指定状态的类型。

## 故障排除

### `Cannot stringify arbitrary non-POJOs`

当尝试使用 `useState` 存储不可序列化数据（如类实例）时，会出现此错误。

如果希望使用 `useState` 存储 Nuxt 不支持的类实例，可以使用 [`definePayloadPlugin`](/docs/api/组合式函数/use-nuxt-app#custom-reducerreviver) 为类添加自定义序列化和反序列化器。

:read-more{to="/docs/api/composables/use-nuxt-app#payload"}
