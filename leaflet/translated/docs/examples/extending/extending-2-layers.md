---
layout: tutorial_v2
title: 扩展 Leaflet，新增图层
---

<br>

本教程假设您已阅读[Leaflet 类继承理论](./extending-1-classes.html)。

在 Leaflet 中，“图层”指的是地图移动时会移动的任何元素。在了解如何从零创建这些图层之前，先解释简单的扩展方法更为容易。

## “扩展方法”

部分 Leaflet 类包含所谓的“扩展方法”：用于编写子类代码的入口点。

其中有一个是 `L.TileLayer.getTileUrl()`。每当需要确定加载哪张图片时，`L.TileLayer` 会内部调用此方法。通过创建 `L.TileLayer` 的子类并重写其 `getTileUrl()` 函数，我们可以实现自定义行为。

让我们通过一个自定义的 `L.TileLayer` 来演示，该图层将从 [PlaceKitten]() 显示随机小猫图片：

    L.TileLayer.Kitten = L.TileLayer.extend({
        getTileUrl: function(coords) {
            var i = Math.ceil( Math.random() * 4 );
            return "https://placekitten.com/256/256?image=" + i;
        },
        getAttribution: function() {
            return "<a href='https://placekitten.com/attribution.html'>PlaceKitten</a>"
        }
    });

    L.tileLayer.kitten = function() {
        return new L.TileLayer.Kitten();
    }

    L.tileLayer.kitten().addTo(map);

{% include frame.html url="kittenlayer.html" %}

通常，`getTileUrl()` 会接收瓦片坐标（即 `coords.x`、`coords.y` 和 `coords.z`），并基于这些坐标生成瓦片 URL。在示例中，我们忽略这些参数，而是使用随机数每次获取不同的小猫图片。

### 分离插件代码

在之前的示例中，`L.TileLayer.Kitten` 定义在与其使用的位置相同的文件中。对于插件而言，将插件代码拆分为独立文件并在使用时包含该文件更为合适。

对于 KittenLayer，您应该创建一个名为 `L.KittenLayer.js` 的文件：

    L.TileLayer.Kitten = L.TileLayer.extend({
        getTileUrl: function(coords) {
            var i = Math.ceil( Math.random() * 4 );
            return "https://placekitten.com/256/256?image=" + i;
        },
        getAttribution: function() {
            return "<a href='https://placekitten.com/attribution.html'>PlaceKitten</a>"
        }
    });

然后在显示地图时包含此文件：

	<html>
	…
	<script src='leaflet.js'>
	<script src='L.KittenLayer.js'>
	<script>
		var map = L.map('map-div-id');
		L.tileLayer.kitten().addTo(map);
	</script>
	…


### `L.GridLayer` 和 DOM 元素

Another extension method is `L.GridLayer.createTile()`. Where `L.TileLayer` assumes that there is a grid of images (as `<img>` elements), `L.GridLayer` doesn't assume that - it allows creating grids of any kind of [HTML Elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Element).

`L.GridLayer` allows creating grids of `<img>`s, but grids of [`<div>`s](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/div), [`<canvas>`es](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas) or [`<picture>`s](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture) (or anything) are possible. `createTile()` just has to return an instance of [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement) given the tile coordinates. Knowing how to manipulate elements in the [DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction) is important here: Leaflet expects instances of `HTMLElement`, so elements created with libraries like jQuery will be problematic.

An example of a custom `GridLayer` is showing the tile coordinates in a `<div>`. This is particularly useful when debugging the internals of Leaflet, and for understanding how the tile coordinates work:

	L.GridLayer.DebugCoords = L.GridLayer.extend({
		createTile: function (coords) {
			var tile = document.createElement('div');
			tile.innerHTML = [coords.x, coords.y, coords.z].join(', ');
			tile.style.outline = '1px solid red';
			return tile;
		}
	});

	L.gridLayer.debugCoords = function(opts) {
		return new L.GridLayer.DebugCoords(opts);
	};

	map.addLayer( L.gridLayer.debugCoords() );


如果元素需要异步初始化，则使用第二个函数参数 `done`，在瓦片准备就绪时（例如图片完全加载后）或出现错误时调用它。在这里，我们只是人为地延迟瓦片的显示：

	createTile: function (coords, done) {
		var tile = document.createElement('div');
		tile.innerHTML = [coords.x, coords.y, coords.z].join(', ');
		tile.style.outline = '1px solid red';

		setTimeout(function () {
			done(null, tile);	// Syntax is 'done(error, tile)'
		}, 500 + Math.random() * 1500);

		return tile;
	}

{% include frame.html url="gridcoords.html" %}

With these custom `GridLayer`s, a plugin can have full control of the HTML elements that make up the grid. A few plugins already use `<canvas>`es in this way to do advanced rendering.

A very basic `<canvas>` `GridLayer` looks like:

	L.GridLayer.CanvasCircles = L.GridLayer.extend({
		createTile: function (coords) {
			var tile = document.createElement('canvas');

			var tileSize = this.getTileSize();
			tile.setAttribute('width', tileSize.x);
			tile.setAttribute('height', tileSize.y);

			var ctx = tile.getContext('2d');

			// Draw whatever is needed in the canvas context
			// For example, circles which get bigger as we zoom in
			ctx.beginPath();
			ctx.arc(tileSize.x/2, tileSize.x/2, 4 + coords.z*4, 0, 2*Math.PI, false);
			ctx.fill();

			return tile;
		}
	});

{% include frame.html url="canvascircles.html" %}


## 像素原点

创建自定义 `L.Layer` 是可能的，但需要深入了解 Leaflet 如何定位 HTML 元素。简略版本如下：

* The `L.Map` container has "map panes", which are `<div>`s.
* `L.Layer` 是地图窗格内的 HTML 元素
* 该地图将所有 `LatLng` 转换为地图坐标系的坐标，再转换为绝对的“像素坐标”（坐标系的原点与像素坐标的原点相同）
* 当 `L.Map` 准备就绪（具有中心 `LatLng` 和缩放级别）时，左上角的绝对像素坐标成为“像素原点”
* 每个 `L.Layer` 根据像素原点及该层 `LatLng` 的绝对像素坐标在地图窗格中偏移
* 每次 `zoomend` 或 `viewreset` 事件触发后，“像素原点”会被重置，每个 `L.Layer` 必须重新计算其位置（如需要）
* 平移地图时“像素原点”不会重置；而是整个窗格会重新定位。

这可能会有些难以理解，可以参考以下解释性地图：

{% include frame.html url="pixelorigin.html" %}

坐标系原点（绿色）保持在同一 `LatLng` 位置。像素原点（红色）始终从左上角开始。平移地图时像素原点会移动（窗格相对于地图容器重新定位），而缩放时则保持不变（窗格不重新定位，但图层可能会重新绘制）。缩放时会更新到像素原点的绝对像素坐标，但平移时不会更新。注意，当地图放大时，绝对像素坐标（与绿色框的距离）会翻倍。

为了定位任何元素（例如蓝色 `L.Marker`），其 `LatLng` 会被转换为地图坐标系 `L.CRS` 中的绝对像素坐标。然后，从该绝对像素坐标中减去像素原点的绝对像素坐标，得到相对于像素原点的偏移量（浅蓝色）。由于像素原点是所有地图窗格的左上角，此偏移量可以应用于标记图标的 HTML 元素。标记的 `iconAnchor`（深蓝色线）通过负的 CSS 外边距实现。

`L.Map.project()` 和 `L.Map.unproject()` 方法使用这些绝对像素坐标进行操作。同样，`L.Map.latLngToLayerPoint()` 和 `L.Map.layerPointToLatLng()` 则使用相对于像素原点的偏移量。

Different layers apply these calculations in different ways. `L.Marker`s simply reposition their icons; `L.GridLayer`s calculate the bounds of the map (in absolute pixel coordinates) and then calculate the list of tile coordinates to request; vector layers (polylines, polygons, circle markers, etc) transform each `LatLng` to pixels and draw the geometries using SVG or `<canvas>`.


### `onAdd` 和 `onRemove`

本质上，所有 `L.Layer` 都是地图窗格中的 HTML 元素，其位置和内容由该层的代码定义。然而，在实例化层时无法创建 HTML 元素；实际上是在将层添加到地图时才进行创建——在此之前，层并不了解地图（甚至不了解 `document`）。

换句话说：地图调用层的 `onAdd()` 方法，然后层创建其 HTML 元素（通常称为 'container' 元素）并将它们添加到地图窗格中。相反地，当层从地图中移除时，会调用其 `onRemove()` 方法。层在添加到地图时必须更新其内容，并在地图视图更新时重新定位内容。层的骨架如下所示：

	L.CustomLayer = L.Layer.extend({
		onAdd: function(map) {
			var pane = map.getPane(this.options.pane);
			this._container = L.DomUtil.create(…);

			pane.appendChild(this._container);

			// Calculate initial position of container with `L.Map.latLngToLayerPoint()`, `getPixelOrigin()` and/or `getPixelBounds()`

			L.DomUtil.setPosition(this._container, point);

			// Add and position children elements if needed

			map.on('zoomend viewreset', this._update, this);
		},

		onRemove: function(map) {
			L.DomUtil.remove(this._container);
			map.off('zoomend viewreset', this._update, this);
		},

		_update: function() {
			// Recalculate position of container

			L.DomUtil.setPosition(this._container, point);        

			// Add/remove/reposition children elements if needed
		}
	});

如何精确定位层的 HTML 元素取决于该层的具体特性，但本介绍应有助于您阅读 Leaflet 的层代码并创建新层。

### 使用父类的 `onAdd`

某些用例不需要重新创建整个 `onAdd` 代码，而是可以重用父类的代码，然后在初始化之前或之后根据需要添加特定内容。

以一个例子说明，我们可以创建一个始终为红色（`L.Polyline` 的子类，忽略选项设置），如下所示：

	L.Polyline.Red = L.Polyline.extend({
		onAdd: function(map) {
			this.options.color = 'red';
			L.Polyline.prototype.onAdd.call(this, map);
		}
	});
