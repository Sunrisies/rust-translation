---
layout: tutorial_v2
title: 缩放级别
---

<style>
.tiles img {
    border: 1px solid #ccc;
    border-radius: 5px;
    margin: 5px;
}
.tiles.small img {
    border: 1px solid #ccc;
    border-radius: 5px;
    margin: 1px;
    width: 64px;
    height: 64px;
}
.tiles {
    line-height: 0;
}
.tiles.legend {
    line-height: 1;
}
</style>

## 缩放级别

Leaflet 使用 [纬度](https://en.wikipedia.org/wiki/Latitude)、[经度](https://en.wikipedia.org/wiki/Longitude) 和“缩放级别”工作。

较低的缩放级别意味着地图显示整个大陆，而较高的缩放级别则能显示城市的细节。


To understand how zoom levels work, first we need a basic introduction to <i>geodesy</i>.

## 地球的形状

让我们看看在零缩放级别下的简单地图：

	var map = L.map('map', {
		minZoom: 0,
		maxZoom: 0
	});

	var cartodbAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>';

	var positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
		attribution: cartodbAttribution
	}).addTo(map);

	map.setView([0, 0], 0);

{% include frame.html url="example-zero.html" %}

请注意，“整个地球”仅是一个图像，宽度为 256 像素，高度为 256 像素：

<div class='tiles' style='text-align: center'>
<img src="https://a.basemaps.cartocdn.com/light_all/0/0/0.png" class="bordered-img" alt=""/>
</div>

明确一点：地球不是正方形。实际上，地球的形状是不规则的，可以近似为 [类似于球体的形状](https://en.wikipedia.org/wiki/Geoid)。

因此，我们 *假设* 地球大部分是圆形的。为了使其看起来平坦，我们在周围放置一个假想的圆柱体，将其展开并切割成方形：

<div class='tiles legend' style='text-align: center'>
<a title="By derived from US Government USGS [Public domain], via Wikimedia Commons" href="https://en.wikipedia.org/wiki/Map_projection#Cylindrical"><img width="512" alt="Usgs map mercator" src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Usgs_map_mercator.svg/512px-Usgs_map_mercator.svg.png"/>
<br/>
这被称为“圆柱地图投影”。
</a>
</div>

这不是在平面上显示地球表面的唯一方法。还有
[数百种方法](https://en.wikipedia.org/wiki/Map_projection)，每种方法
都有各自的优缺点。以下 6 分钟的视频是对该主题的很好介绍：
像大地测量、地图投影和坐标系统这些领域非常困难，*非常困难*

<center><iframe width="696" height="392" src="https://www.youtube.com/embed/kIID5FDi2JQ" frameborder="0" allowfullscreen></iframe></center>

Things like geodesy, 地图 projections and coordinate systems are hard, *very hard*
(and out of scope for this tutorial). Assuming that the earth is a square is not
always the right thing to do, but most of the time works fine enough, makes things
simpler, and allows Leaflet (and other 地图 libraries) to be fast.

## 2 的幂次

目前，我们只需 *假设* 世界是正方形：

<div class='tiles' style='text-align: center'>
<img src="https://a.basemaps.cartocdn.com/light_all/0/0/0.png" class="bordered-img" alt=""/>
</div>

当我们在零缩放级别下表示世界时，其宽度为 256 像素，高度为 256 像素。当进入一缩放级别时，宽度和高度翻倍，可以用四个 256 像素×256 像素的图像来表示：

<div class='tiles' style='text-align: center'>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/1/0/0.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/1/1/0.png" class="bordered-img" alt=""/>
</div>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/1/0/1.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/1/1/1.png" class="bordered-img" alt=""/>
</div>
</div>

At each zoom level, each tile is divided in four, and its size (length of the edge, given by the `tileSize` option) doubles, quadrupling the area. (in other words, the width and height of the world is <code>256·2<sup>zoomlevel</sup></code> pixels):

<table><tr><td>
<div class='tiles small' style='text-align: center'>
<img src="https://a.basemaps.cartocdn.com/light_all/0/0/0.png" class="bordered-img" alt=""/>
</div>
</td><td>
<div class='tiles small' style='text-align: center'>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/1/0/0.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/1/1/0.png" class="bordered-img" alt=""/>
</div>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/1/0/1.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/1/1/1.png" class="bordered-img" alt=""/>
</div>
</div>
</td><td>
<div class='tiles small' style='text-align: center'>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/2/0/0.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/1/0.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/2/0.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/3/0.png" class="bordered-img" alt=""/>
</div>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/2/0/1.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/1/1.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/2/1.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/3/1.png" class="bordered-img" alt=""/>
</div>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/2/0/2.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/1/2.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/2/2.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/3/2.png" class="bordered-img" alt=""/>
</div>
<div>
<img src="https://a.basemaps.cartocdn.com/light_all/2/0/3.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/1/3.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/2/3.png" class="bordered-img" alt=""/><img src="https://a.basemaps.cartocdn.com/light_all/2/3/3.png" class="bordered-img" alt=""/>
</div>
</div>
</td></tr>
<tr><td>Zoom 0</td><td>Zoom 1</td><td>Zoom 2</td></tr></table>

这种情况不断重复。大多数瓦片服务提供的瓦片最高可达十八缩放级别，具体取决于
其覆盖范围。这足以看到每个瓦片中的几个街区。

## 关于比例尺的说明

使用圆柱投影的一个缺点是比例尺不是
恒定的，因此在低缩放级别下测量距离或尺寸不可靠。

在[技术术语中](https://en.wikipedia.org/wiki/Map_projection#Projections_by_preservation_of_a_metric_property)，
the cylindrical projection that Leaflet uses is <i>conformal</i> (preserves shapes),
but not <i>equidistant</i> (does not preserve distances), and not <i>equal-area</i>
（不保留面积，因为赤道附近的物体看起来比实际小）。

通过向地图添加 `L.Control.Scale`，并平移到赤道和60°北纬位置，
we can see how the scale factor <b>doubles</b>. The following example uses
[JavaScript超时](https://developer.mozilla.org/docs/Web/API/WindowTimers/setTimeout)
可以自动实现此功能：

	L.control.scale().addTo(map);

	setInterval(function(){
		map.setView([0, 0]);
		setTimeout(function(){
			map.setView([60, 0]);
		}, 2000);
	}, 4000);

{% include frame.html url="example-scale.html" %}

`L-Control.Scale` 显示适用于地图中心点的比例尺。
在高缩放级别下，比例尺变化很小，不易察觉。


## 控制缩放

Leaflet 地图有几种方式来控制显示的缩放级别，但最明显的是
[`setZoom()`](/reference.html#地图-setzoom)。例如，`map.setZoom(0);`
会将 `map` 的缩放级别设置为 `0`。

这个示例再次使用超时来自动在缩放级别 `0` 和 `1` 之间切换：

	setInterval(function(){
		map.setZoom(0);
		setTimeout(function(){
			map.setZoom(1);
		}, 2000);
	}, 4000);

{% include frame.html url="example-setzoom.html" %}

注意，在缩放级别为 `0` 和 `1` 时显示的图片与上一节中显示的图片一致！
其他设置缩放的方法包括：

Other ways of setting the zoom are:

* [`setView(center, zoom)`](/reference.html#地图-setview)，也设置地图中心位置。
* [`flyTo(center, zoom)`](/reference.html#地图-flyto)，类似于 `setView`，但具有平滑动画效果。
* [`zoomIn()` / `zoomIn(delta)`](/reference.html#地图-zoomin)，默认每次放大 `1` 个缩放级别，可放大 `delta` 个级别。
* [`zoomOut()` / `zoomOut(delta)`](/reference.html#地图-zoomout)，默认每次缩小 `1` 个缩放级别，可缩小 `delta` 个级别。
* [`setZoomAround(fixedPoint, zoom)`](/reference.html#地图-setzoomaround)，在保持某点固定的情况下设置缩放级别（类似于滚动条缩放功能）。
* [`fitBounds(bounds)`](/reference.html#地图-fitbounds)，自动计算适合地图矩形区域的缩放比例。


## 分数缩放

A feature introduced in Leaflet 1.0.0 was the concept of <em>fractional zoom</em>.
以前，地图的缩放级别只能为整数（`0`、`1`、`2` 等）；
但现在你可以使用小数形式的数字，例如 `1.5` 或 `1.25`。

默认情况下，分数缩放功能是关闭的。要启用它，请使用
[地图的 `zoomSnap` 选项](/reference.html#地图-zoomsnap)。
`zoomSnap` 选项的默认值为 `1`（这意味着地图的缩放级别
可以是 `0`、`1`、`2` 等）。

如果你将 `zoomSnap` 的值设置为 `0.5`，地图的有效缩放级别
将是 `0`、`0.5`、`1`、`1.5`、`2` 等。

如果你设置值为 `0.1`，地图的有效缩放级别将为 `0`、`0.1`、
`0.2`、`0.3`、`0.4` 等。

以下示例使用了 `zoomSnap` 值为 `0.25`：

	var map = L.map('map', {
		zoomSnap: 0.25
	});

{% include frame.html url="example-fractional.html" %}

如你所见，Leaflet 只会加载缩放级别为 `0` 或 `1` 的图块，并会根据需要
进行缩放。

Leaflet will <em>snap</em> the zoom level to the closest valid one. For example,
如果你有 `zoomSnap: 0.25`，而尝试执行 `map.setZoom(0.8)`，缩放将
回弹到 `0.75`。当使用 `map.fitBounds(bounds)` 或在触摸屏上结束
捏合缩放操作时也会发生同样的情况。

`zoomSnap` can be set to zero. This means that Leaflet will <strong>not</strong>
回弹到某个缩放级别。

与 `zoomSnap` 相关的另一个重要地图选项是 [`zoomDelta` 选项](/reference.html#地图-zoomdelta)。
该选项控制在使用缩放按钮时放大或缩小多少个缩放级别
（来自默认的 [`L.Control.Zoom`](/reference.html#控件-zoom)）
或键盘上的 `+`/`-` 键。

对于鼠标滚轮缩放， [`wheelPxPerZoomLevel`](/reference.html#地图-wheelpxperzoomlevel)
选项控制鼠标滚轮放大或缩小的速度。

以下是将 `zoomSnap` 设置为零的示例：

	var map = L.map('map', {
		zoomDelta: 0.25,
		zoomSnap: 0
	});

尝试以下操作，观察缩放级别的变化：

* 如果你有触摸屏，进行捏合缩放
* 使用鼠标滚轮进行放大/缩小
* 执行框式缩放（在键盘上按住 `shift` 键的同时用鼠标拖动）
* 使用放大/缩小按钮

{% include frame.html url="example-delta.html" %}


本教程到此结束。现在可以在你的地图中尝试不同的缩放级别！
