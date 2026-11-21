---
title: 模块作者指南
titleTemplate: '%s'
description: 了解如何创建 Nuxt 模块，以集成、增强或扩展任何 Nuxt 应用。
navigation: false
surround: false
---

Nuxt 的 [配置系统](/docs/api/nuxt-config)和[钩子系统](/docs/guide/going-further/hooks)使得可以自定义 Nuxt 的各个方面，并添加所需的任何集成功能（如 Vue 插件、内容管理系统、服务器路由、组件、日志记录等）。

**Nuxt 模块**是在开发模式下使用 `nuxt dev` 启动 Nuxt 或构建生产项目时通过顺序运行的函数。
通过模块，你可以封装、进行适当的测试，并将自定义解决方案作为 npm 包共享，而无需在项目中添加不必要的样板代码，也无需对 Nuxt 本身进行修改。

::card-group{class="sm:grid-cols-1"}
  ::card{icon="i-lucide-rocket" title="创建你的第一个模块" to="/docs/guide/modules/getting-started"}
  使用官方模板学习如何创建您的第一个 Nuxt 模块。
  ::
  ::card{icon="i-lucide-box" title="了解模块结构" to="/docs/guide/modules/module-anatomy"}
  了解 Nuxt 模块的结构及其定义方法。
  ::
  ::card{icon="i-lucide-code" title="添加插件、组件及其他功能" to="/docs/guide/modules/recipes-basics"}
  学习如何从模块中注入插件、组件、组合式函数和服务器路由。
  ::
  ::card{icon="i-lucide-link" title="依赖其他模块" to="/docs/guide/modules/module-dependencies"}
  通过版本约束和配置合并来声明对其他模块的依赖。
  ::
  ::card{icon="i-lucide-layers" title="使用钩子与扩展类型" to="/docs/guide/modules/recipes-advanced"}
  掌握模块中的生命周期钩子、虚拟文件和 TypeScript 声明。
  ::
  ::card{icon="i-lucide-test-tube" title="测试你的模块" to="/docs/guide/modules/testing"}
  学习如何通过单元测试、集成测试和端到端测试来测试您的 Nuxt 模块。
  ::
  ::card{icon="i-lucide-medal" title="遵循最佳实践" to="/docs/guide/modules/best-practices"}
  遵循这些指南构建高效且易于维护的 Nuxt 模块。
  ::
  ::card{icon="i-lucide-globe" title="发布与分享你的模块" to="/docs/guide/modules/ecosystem"}
  加入 Nuxt 模块生态系统，并将您的模块发布到 npm。
  ::
::
