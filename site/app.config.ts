export default defineAppConfig({
  // 顶部章节 tab 栏：入门指南 / 目录结构 / 指南 / API / ...
  // 点击后左侧栏只显示当前章节的页面，与 nuxt.com 官网导航一致
  navigation: {
    sub: 'header',
  },
  toc: {
    title: '在本页',
  },
})
