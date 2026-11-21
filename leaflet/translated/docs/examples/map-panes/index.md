---
layout: tutorial_v2
title: 使用地图面板
---

## 什么是面板？

在 Leaflet 中，地图面板会自动将图层组合在一起，开发者无需知晓。这种组合方式使得网络浏览器能够更高效地同时处理多个图层，比单独处理每个图层更为高效。

地图面板利用 [z-index CSS 属性](https://developer.mozilla.org/docs/Web/CSS/z-index) 始终使某些图层显示在其他图层之上。[默认顺序](/reference.html#地图-pane)如下：

* `TileLayer` 和 `GridLayer`
* `Path` 类型，如线条、多段线、圆形或 `GeoJSON` 图层。
* `Marker` 阴影
* `Marker` 图标
* `Popup`s

因此，在 Leaflet 地图中，弹出窗口总是显示在其他图层之上，标记也始终显示在瓦片层之上。

**Leaflet 1.0.0** 的一个新功能（0.7.x 版本没有）是自定义地图面板，这允许对顺序进行定制。

## 默认设置并不总是正确的

在某些特定情况下，默认顺序并不适合地图使用。我们可以通过 [Carto 底图](https://carto.com/location-data-services/basemaps/) 和标签来演示这一点：


<style>
.tiles img {
    border: 1px solid #ccc;
    border-radius: 5px;
}
</style>

<div class='tiles'>
<div style='display: inline-block'>
<img src="https://a.basemaps.cartocdn.com/light_nolabels/4/8/5.png" class="bordered-img" /><br/>
没有标签的底图瓦片
</div>

<div style='display: inline-block'>
<img src="https://a.basemaps.cartocdn.com/light_only_labels/4/8/5.png" class="bordered-img" /><br/>
仅包含透明标签的瓦片
</div>

<div style='display: inline-block; position:relative;'>
<img src="https://a.basemaps.cartocdn.com/light_nolabels/4/8/5.png" class="bordered-img" />
<img src="https://a.basemaps.cartocdn.com/light_only_labels/4/8/5.png"  style='position:absolute; left:0; top:0;'/><br/>
标签位于底图之上
</div>
</div>

如果我们使用这两个瓦片层创建 Leaflet 地图，任何标记或多边形都会显示在两者之上，但将标签放在顶部[看起来更美观](http://blog.cartodb.com/let-your-labels-shine/)。如何实现这一点？

{% include frame.html url="example.html" %}

## 自定义面板

我们可以继续使用底图瓦片的默认设置以及一些叠加层，如 `GeoJSON` 图层，但对于标签，我们必须定义一个自定义面板，使其显示在 `GeoJSON` 数据之上。

自定义地图面板是按地图分别创建的，因此首先创建 `L.Map` 实例和面板：


    var map = L.map('map');
    map.createPane('labels');


下一步是设置面板的 z-index 值。根据 [默认设置](https://github.com/Leaflet/Leaflet/blob/v1.0.0/dist/leaflet.css#L87)，650 的值可以让带有标签的 `TileLayer` 显示在标记上方，但低于弹出框。通过调用 `getPane()` 获取代表该面板的 [`HTMLElement`](https://developer.mozilla.org/docs/Web/API/HTMLElement) 并更改其 z-index：


    map.getPane('labels').style.zIndex = 650;


在地图图层上使用图像瓦片的一个问题是，这些瓦片会捕获点击和触摸事件。如果用户在地图上任意位置点击，网页浏览器会认为她点击的是标签瓦片，而不是 GeoJSON 数据或标记。可以通过 [`pointer-events` CSS 属性](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events) 来解决这一问题：


    map.getPane('labels').style.pointerEvents = 'none';


现在面板已准备就绪，我们可以添加图层，注意在标签瓦片中使用 `pane` 选项：


    var positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
            attribution: '©OpenStreetMap, ©CartoDB'
    }).addTo(map);

    var positronLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', {
            attribution: '©OpenStreetMap, ©CartoDB',
            pane: 'labels'
    }).addTo(map);

    var geojson = L.geoJson(GeoJsonData, geoJsonOptions).addTo(map);

最后，为 GeoJSON 层中的每个要素添加一些交互功能：

    geojson.eachLayer(function (layer) {
        layer.bindPopup(layer.feature.properties.name);
    });

    map.fitBounds(geojson.getBounds());


现在 [示例地图](example.html) 已经完成！



