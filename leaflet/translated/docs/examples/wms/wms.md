---
layout: tutorial_v2
title: 使用WMS和TMS服务
---

<style>
iframe {
    border: 1px solid #ccc;
    border-radius: 5px;
}
</style>

<br/>

WMS，即[*网络地图服务*](https://en.wikipedia.org/wiki/Web_Map_Service)，是专业GIS软件发布地图的一种常见方式（非GIS用户很少使用）。这种格式与地图瓦片类似，但更为通用，在网页地图中的优化程度则较低。WMS图像由其四个角的坐标定义——这是Leaflet在内部进行的计算。

TMS代表[*瓦片地图服务*](https://en.wikipedia.org/wiki/Tile_Map_Service)，是一种更专注于网页地图的地图瓦片标准，与Leaflet在`L.TileLayer`中预期的瓦片非常相似。

WMTS即[*网络地图瓦片服务*](https://en.wikipedia.org/wiki/Web_Map_Tile_Service)，是地图瓦片的标准协议，可直接在`L.TileLayer`中使用。


## Leaflet中的WMS

当有人发布WMS服务时，他们通常会链接到一个名为`GetCapabilities`文档的文件。在本教程中，我们将使用[*Mundialis*](https://www.mundialis.de)提供的WMS服务，地址为http://ows.mundialis.de/services/service? 。该服务的功能描述可在以下URL查看：

	http://ows.mundialis.de/services/service?request=GetCapabilities

Leaflet无法理解WMS `GetCapabilities`文档。相反，你需要创建一个`L.TileLayer.WMS`图层，提供基础WMS URL，并指定所需的WMS选项。

基础WMS URL就是没有参数的`GetCapabilities` URL，如下所示：

	http://ows.mundialis.de/services/service?

在Leaflet地图中使用的方式很简单：

	var map = L.map(mapDiv, mapOptions);

	var wmsLayer = L.tileLayer.wms('http://ows.mundialis.de/services/service?', wmsOptions).addTo(map);

`L.TileLayer.WMS`实例至少需要一个选项：`layers`。请注意，Leaflet中的“图层”概念与WMS中的不同！

WMS服务器在服务中定义了一组*图层*。这些图层在`GetCapabilities` XML文档中定义，通常非常繁琐且难以理解。建议使用[QGIS等软件来查看WMS服务器中可用的图层名称](http://www.qgistutorials.com/en/docs/working_with_wms.html)。

![Discovering WMS layers with QGIS](qgis-wms-layers.png)

我们可以看到[Mundialis] WMS有一个名为`TOPO-OSM-WMS`的WMS图层，带有基础地图。让我们看看它的样子：

	var wmsLayer = L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
		layers: 'TOPO-OSM-WMS'
	}).addTo(map);

{% include frame.html url="wms-example1.html" %}


或者我们可以尝试使用 `SRTM30-Colored-Hillshade` WMS 图层：

	var wmsLayer = L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
		layers: 'SRTM30-Colored-Hillshade'
	}).addTo(map);

{% include frame.html url="wms-example2.html" %}


`layers` 选项是一个用逗号分隔的图层列表。如果某个 WMS 服务定义了多个图层，那么请求地图图像时就可以选择多个图层。

对于我们使用的示例 WMS 服务器，有一个显示世界地形的 `TOPO-WMS` WMS 图层，还有一个显示地点名称的 `OSM-Overlay-WMS` WMS 图层。如果我们同时请求这两个图层，可以用逗号将它们分开，这样 WMS 服务器会将两个图层合并成一张图像。

	var topographyAndPlaces = L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
		layers: 'TOPO-WMS,OSM-Overlay-WMS'
	}).addTo(map);

请注意，这将向 WMS 服务器请求 *一张* 图像。这与创建多个图层不同——一个用于地形，另一个用于地点，然后将其都添加到地图中。在第一种情况下，只有一个图像请求，由 WMS 服务器决定如何合并这些图像。在第二种情况下，会有两个图像请求，由运行在网页浏览器中的 Leaflet 代码来决定如何合并它们。

如果我们结合使用 [layers 控件](/examples/layers-控件.html)，就可以构建一个简单的地图来观察差异：

	var basemaps = {
		Topography: L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
			layers: 'TOPO-WMS'
		}),

		Places: L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
			layers: 'OSM-Overlay-WMS'
		}),

		'Topography, then places': L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
			layers: 'TOPO-WMS,OSM-Overlay-WMS'
		}),

		'Places, then topography': L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
			layers: 'OSM-Overlay-WMS,TOPO-WMS'
		})
	};

	L.control.layers(basemaps).addTo(map);

	basemaps.Topography.addTo(map);

将选项更改为“地形，然后地点”，这样你可以看到地点位于地形之上，但 WMS 服务器足够智能，能够显示建筑物标签在地形之上。当请求多个图层时，如何合并这些图层由 WMS 服务器决定。

{% include frame.html url="wms-example3.html" %}


### WMS 服务对 GIS 用户的注意事项

从 GIS 的角度来看，Leaflet 中的 WMS 处理方式相当基础。没有 `GetCapabilities` 支持、没有图例支持，也没有 `GetFeatureInfo` 支持。

`L.TileLayer.WMS` 有额外的选项，可以在 [Leaflet API 文档](/reference.html#tilelayer-wms)中找到。如果文档中没有描述的任何选项，都会通过 `getImage` URL 传递给 WMS 服务器。

另外需要注意的是，Leaflet 支持的[坐标系统](https://en.wikipedia.org/wiki/Spatial_reference_system)非常有限：`CRS:3857`、`CRS:3395`和`CRS:4326`（请参阅`L.CRS`文档）。如果您的 WMS 服务不在这些坐标系统中提供图像，您可能需要使用[Proj4Leaflet](https://github.com/kartena/Proj4Leaflet)在 Leaflet 中采用不同的坐标系统。除此之外，只需在初始化地图时选择正确的 CRS，任何添加的 WMS 图层都将使用该 CRS。

	var map = L.map('map', {
		crs: L.CRS.EPSG4326
	});

	var wmsLayer = L.tileLayer.wms('http://ows.mundialis.de/services/service?', {
		layers: 'TOPO-OSM-WMS'
	}).addTo(map);

{% include frame.html url="wms-example-crs.html" %}
	
	
## Leaflet 对 TMS 服务的支持并不明确，但瓦片命名结构与常见的`L.TileLayer`命名方案非常相似，因此显示 TMS 服务几乎很简单。

Leaflet doesn't have explicit support for TMS services, but the tile naming structure is so similar to the common `L.TileLayer` naming scheme, that displaying a TMS service is almost trivial.

让我们考虑一个具有以下端点的 TMS 服务器：

	http://base_url/tms/1.0.0

通过查看[MapCache关于 TMS的帮助文档](http://mapserver.org/mapcache/services.html)和[TMS规范](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification)，您可以看到 TMS 中地图瓦片的 URL 类似于：

	http://base_url/tms/1.0.0/ {tileset} / {z} / {x} / {y} .png

要将 TMS 服务作为`L.TileLayer`使用，我们可以查看能力文档（与我们的情况相同，为`http://base_url/tms/1.0.0`）以了解可用的`tileset`，并构建我们的基础 URL：

	http://base_url/tms/1.0.0/{example_layer}@png/{z}/{x}/{y}.png


在实例化图层时，使用`tms:true`选项，如下所示：

	var tms_example = L.tileLayer('http://base_url/tms/1.0.0/example_layer@png/{z}/{x}/{y}.png', {
		tms: true
	}).addTo(map);


**Leaflet 1.0**中的一个新功能是在 URL 中使用`{-y}`而不是`tms: true`选项，例如：

	var layer = L.tileLayer('http://base_url/tms/1.0.0/tileset/{z}/{x}/{-y}.png');

在 Leaflet 0.7 中需要`tms: true`选项，在 Leaflet 1.0 中需要`{-y}`，因为普通`L.TileLayer`的坐标原点是左上角，因此 Y 坐标向下变化。而在 TMS 中，坐标原点是左下角，因此 Y 坐标向上变化。

除了 Y 坐标的差异和 tileset 的识别之外，TMS 服务提供的瓦片方式与`L.TileLayer`期望的方式完全一致。
