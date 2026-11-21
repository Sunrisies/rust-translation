---
title: Nuxt 目录结构
description: 了解 Nuxt 应用的目录结构及其使用方式。
navigation: false
---

Nuxt 应用具有特定的目录结构，用于组织代码。这种结构旨在易于理解且使用一致。

## 根目录

Nuxt 应用的根目录是包含 `nuxt.config.ts` 文件的目录。该文件用于配置 Nuxt 应用。

## App 目录

`app/` 目录是 Nuxt 应用的主目录。它包含以下子目录：
- [`assets/`](/docs/directory-structure/app/assets)：构建工具（Vite 或 webpack）将处理的网站资源
- [`components/`](/docs/directory-structure/app/components)：应用的 Vue 组件
- [`composables/`](/docs/directory-structure/app/组合式函数)：添加你的 Vue 组合式函数
- [`layouts/`](/docs/directory-structure/app/layouts)：包裹页面的 Vue 组件，避免页面间重新渲染
- [`middleware/`](/docs/directory-structure/app/中间件)：在导航到特定路由之前运行代码
- [`pages/`](/docs/directory-structure/app/pages)：基于文件的路由机制，用于在你的 Web 应用内创建路由
- [`plugins/`](/docs/directory-structure/app/plugins)：在创建 Nuxt 应用时使用 Vue 插件等
- [`utils/`](/docs/directory-structure/app/utils)：在应用各处添加函数，这些函数可在组件、组合式函数和页面中使用。

该目录还包含特定文件：
- [`app.config.ts`](/docs/directory-structure/app/app-config)：应用内的响应式配置
- [`app.vue`](/docs/directory-structure/app/app)：你的 Nuxt 应用的根组件
- [`error.vue`](/docs/directory-structure/app/error)：你的 Nuxt 应用的错误页面
- [`spa-loading-template.html`](/docs/directory-structure/app/spa-loading-template)：客户端渲染（`ssr: false`）页面初始化时显示的加载屏幕

## 公共目录

`public/` (/docs/directory-structure/public) 目录包含 Nuxt 应用的公共文件。该目录中的文件在根路径下提供，不会被构建过程修改。

此选项适用于必须保留名称的文件（例如 `robots.txt`）或可能不会更改的文件（例如 `favicon.ico`）。

## 服务器目录

`[server/`](/docs/directory-structure/server) 目录包含 Nuxt 应用的服务器端代码。它包含以下子目录：
- `[api/`](/docs/directory-structure/server#server-routes)：包含应用程序的 API 路由。
- `[routes/`](/docs/directory-structure/server#server-routes)：包含应用程序的服务器路由（例如动态 `/sitemap.xml`）。
- `[middleware/`](/docs/directory-structure/server#server-中间件)：在服务器路由处理之前运行代码。
- `[plugins/`](/docs/directory-structure/server#server-plugins)：在创建 Nuxt 服务器时使用插件及其他功能。
- `[utils/`](/docs/directory-structure/server#server-utilities)：在您的应用程序中添加可在服务器代码中使用的函数。

## 共享目录

`[shared/`](/docs/directory-structure/shared) 目录包含 Nuxt 应用和 Nuxt 服务器的共享代码。此代码可以在 Vue 应用和 Nitro 服务器中使用。

## 测试目录

`[test/`](/docs/directory-structure/test) 目录是进行应用程序测试（单元测试、Nuxt 运行时测试和端到端测试）的推荐位置。有关布局和设置细节，请参阅 [组织您的测试](/docs/getting-started/testing#organizing-your-tests)。

## 内容目录

`[content/`](/docs/directory-structure/content) 目录由 [Nuxt Content](https://content.nuxt.com) 模块启用。它用于使用 Markdown 文件为您的应用程序创建基于文件的 CMS。

## 模块目录

`[modules/`](/docs/directory-structure/modules) 目录包含 Nuxt 应用的本地模块。模块用于扩展 Nuxt 应用的功能。

## 层目录

`[layers/`](/docs/directory-structure/layers) 目录允许您组织和共享可复用的代码、组件、组合式函数和配置。此目录中的层会自动在您的项目中注册。

## Nuxt 文件

- `[nuxt.config.ts`](/docs/directory-structure/nuxt-config) 文件是 Nuxt 应用的主要配置文件。
- `[`.nuxtrc`](/docs/directory-structure/nuxtrc) 文件是配置 Nuxt 应用的另一种语法（适用于全局配置）。
- `[`.nuxtignore`](/docs/directory-structure/nuxtignore) 文件用于在构建阶段忽略根目录下的文件。
