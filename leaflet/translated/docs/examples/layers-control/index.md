---
layout: tutorial_v2
title: 图层组与图层控制
---

## 图层组与图层控制

本教程将展示如何将多个图层合并为一组，以及如何使用图层控制功能让用户轻松切换地图上的不同图层。

{% include frame.html url="example.html" %}

### 图层组

假设你有许多图层需要组合成一个组，以便在代码中统一处理：

	var littleton = L.marker([39.61, -105.02]).bindPopup('This is Littleton, CO.'),
		denver    = L.marker([39.74, -104.99]).bindPopup('This is Denver, CO.'),
		aurora    = L.marker([39.73, -104.8]).bindPopup('This is Aurora, CO.'),
	    golden    = L.marker([39.77, -105.23]).bindPopup('This is Golden, CO.');

Instead of adding them directly to the map, you can do the following, using the <a href="/reference.html#layergroup">LayerGroup</a> class:

	var cities = L.layerGroup([littleton, denver, aurora, golden]);

这很简单！现在你有一个 `cities` 图层，它将城市标记合并为一个图层，你可以随时向地图中添加或移除该图层。

### 图层控制

Leaflet 有一个便捷的控制功能，允许用户控制他们在地图上看到的图层。除了演示如何使用该功能外，我们还将展示图层组的另一个实用用途。

图层有两种类型：(1) 互斥的基础层（一次只能在地图中显示一个），例如瓦片图层；(2) 叠加层，即覆盖在基础层上的所有其他内容。在本示例中，我们希望有两个基础层（黑白灰度图层和彩色基础图层）进行切换，以及一个叠加层用于开启和关闭：之前创建的城市标记。

现在让我们创建这些基础层并将默认图层添加到地图中：

<pre><code>var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

var streets = L.tileLayer(mapboxUrl, {id: 'mapbox/streets-v11', tileSize: 512, zoomOffset: -1, 归属信息: mapboxAttribution});

var 地图 = L.地图('地图', {
	center: [39.73, -104.99],
	zoom: 10,
	layers: [osm, cities]
};</code></pre>

Next, we'll create two objects. One will contain our base layers and one will contain our overlays. These are just simple objects with key/value pairs. The key sets the text for the 图层 in the 控件 (e.g. "Streets"), while the corresponding value is a reference to the 图层 (e.g. `streets`).

<pre><code>var baseMaps = {
	"OpenStreetMap": osm,
	"Mapbox Streets": streets
};

var overlayMaps = {
	"Cities": cities
};</code></pre>

现在，只需创建一个[图层控制](/reference.html#控件-layers)并将其添加到地图中即可。创建图层控制时传递的第一个参数是基础图层对象，第二个参数是叠加层对象。这两个参数都是可选的：你可以省略第二个参数只传递基础图层对象，或者将`null`作为第一个参数传递叠加层对象。在每种情况下，被省略的图层类型都不会出现在用户选择选项中。

<pre><code>var layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);</code></pre>

请注意，我们在地图中添加了`osm`和`cities`图层，但没有添加`streets`图层。图层控制能够智能地识别已添加的图层，并自动设置相应的复选框和单选框。

另外需要注意的是，当使用多个基础图层时，在实例化时只应将一个添加到地图中，但在创建图层控制时，所有图层都应在基础图层对象中存在。

你在定义图层对象时也可以对键进行样式设置。例如，以下代码会使灰度图的标签变为灰色：

<pre><code>var baseMaps = {
	"&lt;span style='color: gray'&gt;Grayscale&lt;/span&gt;": grayscale,
	"Streets": streets
};
</code></pre>

最后，你可以动态添加或移除基础图层或叠加层：

<pre><code>var crownHill = L.marker([39.75, -105.09]).bindPopup('This is Crown Hill Park.'),
    rubyHill = L.marker([39.68, -105.00]).bindPopup('This is Ruby Hill Park.');
    
var parks = L.layerGroup([crownHill, rubyHill]);
var satellite = L.tileLayer(mapboxUrl, {id: '<a href="https://mapbox.com">MapID</a>', tileSize: 512, zoomOffset: -1, attribution: mapboxAttribution});

layerControl.addBaseLayer(satellite, "Satellite");
layerControl.addOverlay(parks, "Parks");
</code></pre>


现在让我们[在另一个页面上查看结果&rarr;](example.html)

