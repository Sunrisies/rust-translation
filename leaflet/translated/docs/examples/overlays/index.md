---
layout: tutorial_v2
title: Overlays
---

## Overlays

Leaflet API 中有 3 种覆盖层：
- [`ImageOverlay`](/reference.html#imageoverlay): 栅格图层，扩展 [`Layer`](/reference.html#图层)
- [`VideoOverlay`](/reference.html#videooverlay): 栅格图层，扩展 [`ImageOverlay`](/reference.html#imageoverlay)
- [`SVGOverlay`](/reference.html#svgoverlay): 矢量图层，扩展 [`ImageOverlay`](/reference.html#imageoverlay)

在本教程中，你将学习如何使用这些覆盖层。

### `ImageOverlay`

`L.ImageOverlay` 用于在地图的特定范围内加载和显示单个图像。

要添加 `L.ImageOverlay` 图像覆盖层，请使用以下代码：

```
var imageOverlay = L.imageOverlay(imageUrl, latLngBounds, options);
```

#### 创建地图

首先，以常规方式创建 Leaflet 地图，并添加背景 `L.TileLayer`：

```
var map = L.map('map').setView([37.8, -96], 4);

var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
```

让我们创建一个具有多种选项的图像覆盖层：

```
var imageUrl = 'https://maps.lib.utexas.edu/maps/historical/newark_nj_1922.jpg';
var errorOverlayUrl = 'https://cdn-icons-png.flaticon.com/512/110/110686.png';
var altText = 'Image of Newark, N.J. in 1922. Source: The University of Texas at Austin, UT Libraries Map Collection.';
var latLngBounds = L.latLngBounds([[40.799311, -74.118464], [40.68202047785919, -74.33]]);

var imageOverlay = L.imageOverlay(imageUrl, latLngBounds, {
	opacity: 0.8,
	errorOverlayUrl: errorOverlayUrl,
	alt: altText,
	interactive: true
}).addTo(map);
```

如果你想查看被 ImageOverlay 覆盖的区域，可以在地图上添加带有相同 `L.LatLngBounds` 的 [`L.Rectangle`](/reference.html#rectangle)：

```
L.rectangle(latLngBounds).addTo(map);
map.fitBounds(latLngBounds);
```

- `opacity` 定义图像覆盖层的透明度，默认值为 `1.0`。降低此值可使图像覆盖层透明，并显示底层的地图图层。
	
- `errorOverlayUrl` 是用于显示未能加载的覆盖层图像的 URL。

- `alt` 设置 HTML [`alt`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attr-alt) 属性，以提供图像的替代文本描述。替代文本对屏幕阅读器用户来说非常重要。在网络连接不良时，如果图像无法加载，它也能帮助用户理解内容。此外，它还可以提升网站的 SEO 效果。

- `interactive` 默认值为 `false`。如果设置为 `true`，图像覆盖层在点击或悬停时会发出鼠标事件。

你可以在 [文档](/reference.html#imageoverlay)中找到 `L.ImageOverlay` 的其他选项。

{% include frame.html url="example-image.html" %}

### `VideoOverlay`

Video used to be a hard task when building a webpage, until the [`<video>` HTML element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) was made available.

如今，我们可以使用以下 HTML 代码：

```
<video width="500" controls>
	<source src="https://www.mapbox.com/bites/00188/patricia_nasa.webm" type="video/webm">
	<source src="https://www.mapbox.com/bites/00188/patricia_nasa.mp4" type="video/mp4">
</video>
```

要显示此视频：

<video width="500" controls>
<source src="https://www.mapbox.com/bites/00188/patricia_nasa.webm" type="video/webm">
<source src="https://www.mapbox.com/bites/00188/patricia_nasa.mp4" type="video/mp4">
</video>

如果视频能够以这种方式在网页上显示，那么 Leaflet 就可以在地图中展示它。重要的是，视频的制作方式要使其适合地图：视频应采用“北上”方向，其比例也要与地图匹配，否则会显得不协调。

#### 创建地图

首先，创建一个 Leaflet 地图，并以常规方式添加背景 `L.TileLayer`：

```
var map = L.map('map').setView([37.8, -96], 4);

var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
```

#### 添加视频覆盖层

添加视频覆盖层的过程与添加图像覆盖层非常相似。

对于视频覆盖层，只需：

- 使用 `L.VideoOverlay` 而不是 `L.ImageOverlay`
- `L.VideoOverlay` 用于在地图的特定范围内加载和显示视频播放器。它扩展了 [`L.ImageOverlay`](/reference.html#imageoverlay)。
A video overlay uses the [`<video>`](https://developer.mozilla.org/docs/Web/HTML/Element/video) HTML element.
- 无需提供图像 URL，只需提供一个视频 URL 或数组形式的视频 URL。

```
var videoUrls = [
	'https://www.mapbox.com/bites/00188/patricia_nasa.webm',
	'https://www.mapbox.com/bites/00188/patricia_nasa.mp4'
];
var errorOverlayUrl = 'https://cdn-icons-png.flaticon.com/512/110/110686.png';
var latLngBounds = L.latLngBounds([[32, -130], [13, -100]]);

var videoOverlay = L.videoOverlay(videoUrls, latLngBounds, {
	opacity: 0.8,
	errorOverlayUrl: errorOverlayUrl,
	interactive: true,
	autoplay: true,
	muted: true,
	playsInline: true
}).addTo(map);
```

这样即可在地图上看到视频：

{% include frame.html url="example-nocontrols.html" %}

- `autoplay` 选项定义了视频在加载时是否自动播放。默认值为 `true`。需要注意的是，在某些浏览器中，`autoplay` 功能只有在 `muted` 选项明确设置为 `true` 时才有效。

- `muted` 选项定义了视频在加载时是否处于静音状态。默认值为 `false`。

- 当 `playsInline` 设置为 `true` 时，允许视频在移动浏览器中直接播放而不自动进入全屏模式。默认值为 `true`。

您可以在 [文档](/reference.html#videooverlay)中找到 `L.videoOverlay` 的其他选项。

视频覆盖层与其他 Leaflet 图层一样——可以添加和移除它们，允许用户通过 [图层控制](../layers-控件/) 从多个视频中选择。


#### 对视频进行一些控制

如果您阅读 API 文档，会注意到 `L.VideoOverlay` 类没有 `play()` 或 `pause()` 方法。

为此，视频覆盖层的 `getElement()` 方法非常有用。它返回用于覆盖层的 [`HTMLVideoElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement)（该元素继承自 [`HTMLMediaElement`](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement)），并且具有 `play()` 和 `pause()` 等方法。

```
videoOverlay.getElement().pause();
```

这使我们能够构建自定义界面。例如，我们可以创建一个 `L.Control` 的子类，在视频覆盖层加载后执行播放/暂停操作。

```
videoOverlay.on('load', function () {
	var MyPauseControl = L.Control.extend({
		onAdd: function() {
			var button = L.DomUtil.create('button');
			button.title = 'Pause';
			button.innerHTML = '<span aria-hidden="true">⏸</span>';
			L.DomEvent.on(button, 'click', function () {
				videoOverlay.getElement().pause();
			});
			return button;
		}
	});
	var MyPlayControl = L.Control.extend({
		onAdd: function() {
			var button = L.DomUtil.create('button');
			button.title = 'Play';
			button.innerHTML = '<span aria-hidden="true">▶️</span>';
			L.DomEvent.on(button, 'click', function () {
				videoOverlay.getElement().play();
			});
			return button;
		}
	});

	var pauseControl = (new MyPauseControl()).addTo(map);
	var playControl = (new MyPlayControl()).addTo(map);
});
```

{% include frame.html url="example-video.html" %}

### `SVGOverlay`

`L.SVGOverlay` 用于在特定地图范围内加载、显示并提供对 SVG 文件的 DOM 访问权限。

要添加 SVG 覆盖层，请使用 [`L.SVGOverlay`](/reference.html#svgoverlay)：

```
var svgOverlay = L.svgOverlay(SVGElement, svgElementBounds, options);
```

它根据提供的 SVG 元素及其地理范围来实例化图像覆盖对象。SVG 元素上需要包含 `viewBox` 属性，以便正确缩放。

#### 创建 SVG 元素

让我们创建一个 SVG 元素：

```
var svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
svgElement.setAttribute('viewBox', '0 0 200 200');
svgElement.innerHTML = '<rect width="200" height="200"/><rect x="75" y="23" width="50" height="50" style="fill:red"/><rect x="75" y="123" width="50" height="50" style="fill:#0013ff"/>';
```

或者，您也可以在 HTML 代码中创建 SVG 元素：

```
<svg id="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200"/><rect x="75" y="23" width="50" height="50" style="fill:red"/><rect x="75" y="123" width="50" height="50" style="fill:#0013ff"/></svg>
```

然后可以通过 `querySelector` 选择该 SVG 元素：

```
var svgElement = document.querySelector('#svg');
```

#### 添加 SVG 覆盖层

按照与 ImageOverlay 和 VideoOverlay 类似的方式，使用所需选项创建 SVGOverlay：

```
var latLngBounds = L.latLngBounds([[32, -130], [13, -100]]);
map.fitBounds(latLngBounds);

var svgOverlay = L.svgOverlay(svgElement, latLngBounds, {
	opacity: 0.7,
	interactive: true
}).addTo(map);
```

虽然 SVGOverlay 没有自己独特的选项，但它从 ImageOverlay、Interactive 图层 和 图层 中继承了多种选项。
请查看文档以了解更多 [`L.SVGOverlay`](/reference.html#svgoverlay) 选项。

{% include frame.html url="example-svg.html" %}
