export default defineNuxtConfig({
  extends: ['docus'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  site: {
    name: 'Nuxt 文档（中文）· v4.6.4',
    url: 'http://localhost:3000'
  },
  // Umami 追踪脚本（注入到每个静态页的 <head>）
  // 此 id 专用于 WorkBuddy 托管站点；自有服务器用 recorder.js + 另一个 id（见 deploy-server）
  app: {
    head: {
      script: [
        {
          src: 'https://umami.sunrise1024.top/script.js',
          defer: true,
          'data-website-id': '1b580d0f-9fca-40f0-a513-1401faa8d557',
        },
      ],
    },
  },
  docus: {
    locale: 'zh-CN'
  },
  // 顶部章节 tab 栏（官网导航样式），在 appConfig 里显式设置确保静态生成生效
  appConfig: {
    navigation: {
      sub: 'header',
    },
    toc: {
      title: '在本页',
    },
  },
  // 静态托管没有 IPX 动态优化端点，禁用图片优化，直接输出原始路径
  image: {
    provider: 'none'
  },
  nitro: {
    // 完整静态预渲染：爬取所有内部链接，每页生成独立 HTML（不依赖 JS）
    prerender: {
      crawlLinks: true,
      failOnError: false
    }
  }
})
