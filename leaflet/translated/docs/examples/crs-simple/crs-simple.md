---
layout: tutorial_v2
title: 非地理地图
---

<style>
iframe {
    border: 1px solid #ccc;
    border-radius: 5px;
}
</style>

## 非此地球

有时，地图并不代表地球表面的事物，因此没有地理经度和纬度的概念。通常这指的是大型扫描图像，例如游戏地图。

在本教程中，我们选取了《星际控制II》中的星图，该游戏现在作为[开源项目 The Ur-Quan Masters](https://en.wikipedia.org/wiki/Star_Control_II#The_Ur-Quan_Masters)提供。这些地图是通过[读取游戏开源数据文件的工具](http://www.highprogrammer.com/alan/games/video/uqm/index.html)制作的（该网页已删除，可查看[存档版本](https://web.archive.org/web/20171112052528/https://www.highprogrammer.com/alan/games/video/uqm/index.html)），外观如下：

<center>
<img src="uqm_map_400px.png" style="border: 1px solid #ccc; border-radius: 5px" /><br/>
</center>

游戏内置了正方形坐标系统，从角落可以看出。这允许我们建立一个坐标系统。

<center>
<img src="uqm_map_detail.png" style="border: 1px solid #ccc; border-radius: 5px" /><br/>
</center>


## CRS.Simple

**CRS**代表[坐标参考系统](https://en.wikipedia.org/wiki/Spatial_reference_system)，是地理学家用来解释坐标向量含义的术语。例如，[15, 60]在地球经纬度系统中表示印度洋中的一个点，在我们的星图中则代表太阳系中的Krueger-Z坐标系。

Leaflet地图只有一个CRS（且*仅一个* CRS），可以在创建地图时更改。对于我们的游戏地图，我们将使用`CRS.Simple`，它代表一个正方形网格：

	var map = L.map('map', {
		crs: L.CRS.Simple
	});

然后我们可以添加一个`L.ImageOverlay`，包含星图图像及其*近似*边界：

	var bounds = [[0,0], [1000,1000]];
	var image = L.imageOverlay('uqm_map_full.png', bounds).addTo(map);

并显示整个地图：

	map.fitBounds(bounds);

{% include frame.html url="crs-simple-example1.html" %}

这个示例并不完全有效，因为执行`fitBounds()`后我们无法看到完整地图。


## CRS.Simple地图常见的陷阱

在默认的Leaflet CRS中，`CRS.Earth`下，360度经度对应256个水平像素（缩放级别为0），约170度纬度对应256个垂直像素（缩放级别为0）。

在 `CRS.Simple` 中，一个水平地图单位对应一个水平像素，垂直方向也是如此。这意味着整个地图大约有 1000x1000 像素大小，无法放入我们的 HTML 容器中。幸运的是，我们可以将 `minZoom` 设置为小于零的值：

	var map = L.map('map', {
		crs: L.CRS.Simple,
		minZoom: -5
	});

### 像素与地图单位

使用 `CRS.Simple` 时常见的错误是认为地图单位等于图像像素。在这种情况下，地图覆盖 1000x1000 个单位，但图像大小为 2315x2315 像素。不同情况可能需要一像素对应一个地图单位，或者 64 像素对应一个地图单位，或其他比例。**在网格中思考地图单位**，然后相应地添加你的图层（如 `L.ImageOverlay`、`L.Marker` 等）。

实际上，我们使用的图像覆盖的地图单位超过 1000 个——存在较大的间隙。通过测量 0 和 1000 坐标之间的像素数并推算，我们可以得到该图像的正确坐标范围：

	var bounds = [[-26.5,-25], [1021.5,1023]];
	var image = L.imageOverlay('uqm_map_full.png', bounds).addTo(map);

顺便说一下，让我们添加一些标记：

	var sol = L.latLng([ 145, 175.2 ]);
	L.marker(sol).addTo(map);
	map.setView( [70, 120], 1);

{% include frame.html url="crs-simple-example2.html" %}

### 这不是你想要的 `LatLng`

你会注意到太阳位于 `[145,175]` 坐标，而不是 `[175,145]`，地图中心也是如此。`CRS.Simple` 中的坐标形式为 `[y, x]`，而非 `[x, y]`，就像 Leaflet 使用 `[lat, lng]` 而非 `[lng, lat]` 一样。

<small>(In technical terms, Leaflet prefers to use [`[northing, easting]`](https://en.wikipedia.org/wiki/Easting_and_northing) over `[easting, northing]` - the first coordinate in a coordinate pair points "north" and the second points "east")</small>

关于 `[lng, lat]`、`[lat, lng]`、`[y, x]` 或 `[x, y]` 的争论并不新鲜，也没有明确的共识（http://www.macwright.org/lonlat/）。这种缺乏共识正是 Leaflet 使用名为 `L.LatLng` 的类而不是更容易引起混淆的 `L.Coordinate` 的原因。

如果你觉得使用 `L.LatLng` 处理 `[y, x]` 坐标没有太大意义，你可以轻松地为它们创建包装层：

	var yx = L.latLng;

	var xy = function(x, y) {
		if (L.Util.isArray(x)) {    // When doing xy([x, y]);
			return yx(x[1], x[0]);
		}
		return yx(y, x);  // When doing xy(x, y);
	};

现在我们可以用 `[x, y]` 坐标添加一些星星甚至导航线：

	var sol      = xy(175.2, 145.0);
	var mizar    = xy( 41.6, 130.1);
	var kruegerZ = xy( 13.4,  56.5);
	var deneb    = xy(218.7,   8.3);

	L.marker(     sol).addTo(map).bindPopup(      'Sol');
	L.marker(   mizar).addTo(map).bindPopup(    'Mizar');
	L.marker(kruegerZ).addTo(map).bindPopup('Krueger-Z');
	L.marker(   deneb).addTo(map).bindPopup(    'Deneb');

	var travel = L.polyline([sol, deneb]).addTo(map);

地图看起来几乎相同，但代码更易于阅读：

{% include frame.html url="crs-simple-example3.html" %}
