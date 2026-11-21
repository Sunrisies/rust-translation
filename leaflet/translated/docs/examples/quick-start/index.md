---
layout: tutorial_v2
title: 快速入门指南
---

## Leaflet 快速入门指南

本逐步指导将帮助您快速掌握 Leaflet 基础操作，包括设置 Leaflet 地图、处理标记点、多线图与弹出框以及处理事件。

{% include frame.html url="example.html" %}

### 准备您的页面

在编写地图代码之前，您需要完成以下准备工作：

 * 在文档的头部部分包含 Leaflet CSS 文件：

		<link rel="stylesheet" href="https://unpkg.com/leaflet@{{ site.latest_leaflet_version}}/dist/leaflet.css"
		  integrity="{{site.integrity_hash_css}}"
		  crossorigin=""/>

 * 在 Leaflet CSS 之后包含 Leaflet JavaScript 文件：

		<!-- Make sure you put this AFTER Leaflet's CSS -->
		<script src="https://unpkg.com/leaflet@{{ site.latest_leaflet_version}}/dist/leaflet.js"
		  integrity="{{site.integrity_hash_uglified}}"
		  crossorigin=""></script>

 * 在您希望显示地图的位置添加一个具有特定 `id` 的 `div` 元素：

		<div id="map"></div>

 * 确保地图容器有定义好的高度，例如通过 CSS 设置：

	<pre><code class="css">#map { height: 180px; }</code></pre>

现在您可以开始初始化地图并对其进行操作了。


### 设置地图


{% include frame.html url="example-basic.html" %}

让我们创建一个以美观的 OpenStreetMap 瓦片显示的伦敦中心地图。从今往后，我们将使用 JavaScript 进行开发。首先，我们初始化地图并将视图设置为选定的地理坐标和缩放级别：

	var map = L.map('map').setView([51.505, -0.09], 13);

默认情况下（因为我们创建地图实例时没有传递任何选项），地图上的所有鼠标和触摸交互都启用，并且具有缩放和来源控制功能。

请注意，`setView` 调用还会返回地图对象——大多数 Leaflet 方法在不返回明确值时都是如此，这允许像 jQuery 一样进行方法链式调用。

接下来，我们将向地图添加一个瓦片层，这里使用的是 OpenStreetMap 瓦片层。创建瓦片层通常涉及设置 [URL 模板](/reference.html#tilelayer-url-template) 用于瓦片图像、来源文本以及该层的最大缩放级别。OpenStreetMap 瓦片适合用于编程构建 Leaflet 地图，但如果要在生产环境中使用这些瓦片，请阅读 [瓦片使用政策](https://operations.osmfoundation.org/policies/tiles/)。

<pre><code class="javascript">L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(地图);</code></pre>

确保所有代码在包含 `div` 和 `leaflet.js` 之后执行。这样就完成了！现在您有一个可使用的 Leaflet 地图了。

值得注意的是，Leaflet 不依赖特定的提供方，这意味着它不会强制使用某种特定的瓦片提供方。此外，Leaflet 中甚至没有一行与特定提供方相关的代码，因此如果你需要的话，可以使用其他提供方。

每当使用基于 OpenStreetMap 的内容时，根据 [版权声明](https://www.openstreetmap.org/copyright)，必须注明出处。大多数其他瓦片提供方（如 [Mapbox](https://docs.mapbox.com/help/how-mapbox-works/归属信息/)、[Stamen](http://maps.stamen.com/) 或 [Thunderforest](https://www.thunderforest.com/terms/））也要求注明出处。确保恰当地感谢来源。


### 标记、圆圈和多边形

{% include frame.html url="example-overlays.html" %}


除了瓦片层之外，你还可以轻松地在地图中添加其他元素，包括标记、折线图、多边形、圆圈和弹出框。让我们添加一个标记：

	var marker = L.marker([51.5, -0.09]).addTo(map);

添加圆圈的过程与之前相同（只需将半径以米为单位作为第二个参数），但通过在创建对象时传递选项来控制其外观。

	var circle = L.circle([51.508, -0.11], {
		color: 'red',
		fillColor: '#f03',
		fillOpacity: 0.5,
		radius: 500
	}).addTo(map);

添加多边形也很简单：

	var polygon = L.polygon([
		[51.509, -0.08],
		[51.503, -0.06],
		[51.51, -0.047]
	]).addTo(map);


### 处理弹出框

{% include frame.html url="example.html" %}

通常当希望向地图上的特定对象附加信息时，就会使用弹出框。Leaflet 为此提供了一个非常实用的快捷方式：

	marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
	circle.bindPopup("I am a circle.");
	polygon.bindPopup("I am a polygon.");

尝试点击我们的对象。`bindPopup` 方法会将带有指定 HTML 内容的弹出框附加到标记上，因此当你点击该对象时就会显示弹出框；而 `openPopup` 方法（仅适用于标记）则会立即打开已附加的弹出框。

你还可以将弹出框作为图层使用（当需要不仅仅是将弹出框附加到对象上的功能时）：

	var popup = L.popup()
		.setLatLng([51.513, -0.09])
		.setContent("I am a standalone popup.")
		.openOn(map);

这里我们使用 `openOn` 而不是 `addTo`，因为它在打开新弹出框时会自动关闭之前打开的弹出框，这对用户体验非常有利。


### 处理事件

每当 Leaflet 发生某些事情时，例如用户点击标记或地图缩放变化，相应的对象就会发送一个事件，你可以通过函数来订阅该事件。这允许你对用户交互做出反应。

	function onMapClick(e) {
		alert("You clicked the map at " + e.latlng);
	}

	map.on('click', onMapClick);

每个对象都有自己的一系列事件——详情请参见[文档](/reference.html)。监听器函数的第一个参数是一个事件对象——它包含关于发生的事件的有用信息。例如，地图点击事件对象（上面的示例中为 `e`）具有 `latlng` 属性，该属性表示点击发生的位置。

让我们通过使用弹出窗口而不是警报来改进示例：

	var popup = L.popup();

	function onMapClick(e) {
		popup
			.setLatLng(e.latlng)
			.setContent("You clicked the map at " + e.latlng.toString())
			.openOn(map);
	}

	map.on('click', onMapClick);

Try clicking on the map and you will see the coordinates in a popup. <a target="_blank" href="example.html">View the full example &rarr;</a>

Now you've learned Leaflet basics and can start building map apps straight away! Don't forget to take a look at the detailed <a href="/reference.html">documentation</a> or <a href="../../examples.html">other examples</a>.
