---
layout: tutorial_v2
title: Leaflet 可访问性基础指南
---

## 可访问的地图

[网页可访问性](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
是指确保不存在阻碍交互或信息获取的障碍的包容性实践。


本 Leaflet 可访问性指南可以帮助您创建适合
各种能力人群使用的地图。

### 保留有用的默认设置

Leaflet 自带一系列有用的默认设置。

地图容器和标记默认支持键盘操作，
这便于无法使用指向设备的用户使用。
在更改此类默认设置之前，请考虑对用户的影响。

### 标记必须带有标签

使用标记时，
确保每个标记都有唯一且描述性的标签非常重要。
[`alt`](/reference.html#标记-alt)
or
[`title`](/reference.html#标记-title):

<pre><code class="javascript">var marker = L.marker([50.4501, 30.5234],
  {alt: 'Kyiv'}).addTo(map) // "Kyiv" is the <a href="https://www.w3.org/TR/accname-1.1/#dfn-accessible-name"><em>accessible name</em></a> of this marker
  .bindPopup('基辅，乌克兰是 Leaflet 的诞生地！');</code></pre>

从而使得标记能够被
[屏幕阅读器](https://en.wikipedia.org/wiki/Screen_reader)
users:

{% include frame.html url="example.html" width=600 height=400 %}

对于 `divIcon` 情况，
[自定义 HTML](/reference.html#divicon-html)
可以提供视觉或非视觉的标签。

### 测试您的地图

发现可访问性问题的最佳方式
是使用键盘以及屏幕阅读器来测试地图，
同时还可以使用键盘。
您可能已经安装了屏幕阅读器，
例如：

- [Narrator](https://support.microsoft.com/en-us/windows/complete-guide-to-narrator-e4397a0d-ef4f-b386-d8ae-c172f109bdb1)
在 Windows 上
- [Orca](https://help.gnome.org/users/orca/stable/index.html.en)
在 Linux 上
- [TalkBack](https://support.google.com/accessibility/android/answer/6283677?hl=en)
在 Android 上
- VoiceOver 在
[macOS](https://support.apple.com/guide/voiceover/welcome/mac)
and
[iOS](https://support.apple.com/guide/iphone/turn-on-and-practice-voiceover-iph3e2e415f/ios)

### 纯粹装饰性的地图

某些地图是
[纯装饰性](https://www.w3.org/TR/WCAG21/#dfn-pure-decoration)
且并非旨在供用户交互使用
（类似于背景图片和视频）。

此类地图应对
辅助技术（AT）隐藏，
且无可聚焦的子孙元素。
这样做是为了避免可能让屏幕阅读器用户困惑，
并消除键盘用户不必要的 Tab 停止点。
实现这一目标的简单方法就是使用 HTML
[`inert` 属性](https://github.com/WICG/inert)
polyfill:

```html
<!-- This map is for aesthetic purposes only, and can not be interacted with! -->
<div id='decorative-map' inert></div>
<script src='https://unpkg.com/wicg-inert@latest/dist/inert.min.js'></script>
```

### 利用插件

[插件](/plugins.html)
可以提升用户的体验，
但在某些情况下也会降低体验。
因此，重要的是你
[测试你的地图](#test-your-maps)
每当新增插件时。

如果你发现插件存在无障碍问题，
请向该插件的作者报告。

一个能够提升用户体验的插件示例是
[Leaflet.fullscreen](https://github.com/Leaflet/Leaflet.fullscreen) 通过允许用户进入全屏模式，
plugin.
By allowing users to enter into fullscreen mode,
他们可以独立探索地图，
集中注意力，
这对键盘和屏幕阅读器用户特别有帮助
（因为它们不太可能无意中在地图外导航），
也适用于一般移动用户。

### 使用最新版本的 Leaflet

Leaflet 一直在提升无障碍功能。
使用最新的稳定版本
[版本](/download.html) 以获得最佳功能！
for the greatest features!
