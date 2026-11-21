---
layout: tutorial_v2
title: 移动设备上的 Leaflet 地图
---

## 移动设备上的 Leaflet 地图

在本示例中，你将学习如何创建适用于 iPhone、iPad 或 Android 手机等移动设备的全屏地图，以及如何轻松检测并使用当前用户位置。

{% include frame.html url="example.html" %}

### 准备页面

首先，我们来看看页面的 HTML 和 CSS 代码。为了让我们的地图 `div` 元素占据所有可用空间（全屏），我们可以使用以下 CSS 代码（注意：在本示例中，我们使用百分比来表示高度。虽然 vh 更好，但由于 Google Chrome 在移动设备上的漏洞问题）：

{: .css}
	body {
		padding: 0;
		margin: 0;
	}
	html, body, #map {
		height: 100%;
		width: 100vw;
	}

此外，我们需要在 `head` 部分或 HTML 页面中添加以下行，以指示移动浏览器禁用不必要的页面缩放，并设置为实际大小：

	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

### 初始化地图

现在我们将在 JavaScript 代码中像在 [快速启动指南](../quick-start/) 中那样初始化地图，显示整个世界：

<pre><code class="javascript">var map = L.map('map').fitWorld();

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(地图);</code></pre>

### Geolocation

Leaflet has a very handy shortcut for zooming the 地图 view to the detected location --- `locate` method with the `setView` option, replacing the usual `setView` method in the code:

	map.locate({setView: true, maxZoom: 16});

Here we specify 16 as the maximum zoom when setting the 地图 view automatically. As soon as the user agrees to share its location and it's detected by the browser, the 地图 will set the view to it. Now we have a working fullscreen mobile 地图! But what if we need to do something after the geolocation completed? Here's what the `locationfound` and `locationerror` events are for. Let's for example add a 标记 in the detected location, showing accuracy in a 弹出窗口, by adding an event listener to `locationfound` event before the `locateAndSetView` call:

	function onLocationFound(e) {
		var radius = e.accuracy;

		L.marker(e.latlng).addTo(map)
			.bindPopup("You are within " + radius + " meters from this point").openPopup();

		L.circle(e.latlng, radius).addTo(map);
	}

	map.on('locationfound', onLocationFound);

Excellent! But it would also be nice to show an error message if the geolocation failed:

	function onLocationError(e) {
		alert(e.message);
	}

	map.on('locationerror', onLocationError);

If you have `setView` option set to true and the geolocation failed, it will set the view to the whole world.

Now the example is complete --- try it on your mobile phone: [View the full example &rarr;](example.html)

下一步行动是查看详细的[文档](/reference.html)，并浏览[其他示例](../../examples.html)。
