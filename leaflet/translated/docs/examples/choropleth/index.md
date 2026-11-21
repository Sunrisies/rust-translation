---
layout: tutorial_v2
title: 交互式分层色地图
---

## 交互式分层色地图

这是一个案例研究，通过[GeoJSON](../GeoJSON/)和一些[自定义控制](/reference.html#控件)来创建美国各州人口密度的彩色交互式[分层色地图](http://en.wikipedia.org/wiki/Choropleth_map)，希望这能说服所有尚未使用 Leaflet 的主要新闻和政府网站开始使用它。

本教程的灵感来自由[Ryan Murphy](http://www.texastribune.org/about/staff/ryan-murphy/)创建的[得克萨斯论坛美国参议院选举结果地图](http://www.texastribune.org/library/data/us-senate-runoff-results-地图/)（同样基于 Leaflet）。

{% include frame.html url="example.html" width=816 height=516 %}

### 数据来源

我们将创建一份美国各州人口密度可视化图表。由于数据量（各州形状和密度值）不大，最方便且简单的存储和展示方式就是[GeoJSON](../GeoJSON/)。

我们的 GeoJSON 数据中的每个要素([us-states.js](us-states.js))如下所示：

	{
		"type": "Feature",
		"properties": {
			"name": "Alabama",
			"density": 94.65
		},
		"geometry": ...
		...
	}

带有州形状的 GeoJSON 由著名的[D3](http://d3js.org/)开发者[Mike Bostock](http://bost.ocks.org/mike)提供，并添加了来自[此 Wikipedia 文章](http://en.wikipedia.org/wiki/List_of_U.S._states_by_population_density)的2011年7月1日美国人口普查局数据中的密度值，并将其分配给 `statesData` JS 变量。

### 基本州地图

让我们在地图上显示我们的州数据：

	var map = L.map('map').setView([37.8, -96], 4);

	var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);

	L.geoJson(statesData).addTo(map);

{% include frame.html url="example-basic.html" %}


### 添加一些颜色

现在我们需要根据各州的人口密度为它们着色。为地图选择合适的颜色可能有些棘手，但有一个很好的工具可以帮忙——[ColorBrewer](http://colorbrewer2.org/)。使用该工具得到的值，我们创建了一个函数，该函数根据人口密度返回一种颜色：

	function getColor(d) {
		return d > 1000 ? '#800026' :
		       d > 500  ? '#BD0026' :
		       d > 200  ? '#E31A1C' :
		       d > 100  ? '#FC4E2A' :
		       d > 50   ? '#FD8D3C' :
		       d > 20   ? '#FEB24C' :
		       d > 10   ? '#FED976' :
		                  '#FFEDA0';
	}

接下来我们定义了一个 GeoJSON 图层的样式函数，使其 `fillColor` 依赖于 `feature.properties.density` 属性，同时调整外观并添加一条虚线描边以增添美观效果。

	function style(feature) {
		return {
			fillColor: getColor(feature.properties.density),
			weight: 2,
			opacity: 1,
			color: 'white',
			dashArray: '3',
			fillOpacity: 0.7
		};
	}

	L.geoJson(statesData, {style: style}).addTo(map);

现在看起来好多了！

{% include frame.html url="example-color.html" %}


### 添加交互功能

现在让我们在鼠标悬停时以某种方式突出显示状态。首先，我们为“mouseover”事件定义一个事件监听器：

	function highlightFeature(e) {
		var layer = e.target;

		layer.setStyle({
			weight: 5,
			color: '#666',
			dashArray: '',
			fillOpacity: 0.7
		});

		if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
			layer.bringToFront();
		}
	}

通过 `e.target` 我们可以访问被悬停的层，并在该层上设置粗灰边框作为高亮效果，同时将其置于最前面，以避免边框与附近状态冲突（但在 IE、Opera 或 Edge 中不行，因为它们在“mouseover”时无法执行 `bringToFront`）。

接下来我们定义“mouseout”时的行为：

	function resetHighlight(e) {
		geojson.resetStyle(e.target);
	}

方便的 `geojson.resetStyle` 方法会将层样式重置为默认状态（由我们的 `style` 函数定义）。为了使其生效，请确保通过 `geojson` 变量可以访问我们的 GeoJSON 层，在监听器之前定义它，并在之后将其分配给该变量：

	var geojson;
	// ... our listeners
	geojson = L.geoJson(...);

作为额外改进，我们定义一个“click”监听器以放大到该状态：

	function zoomToFeature(e) {
		map.fitBounds(e.target.getBounds());
	}

现在我们将使用 `onEachFeature` 选项在状态层上添加监听器：

	function onEachFeature(feature, layer) {
		layer.on({
			mouseover: highlightFeature,
			mouseout: resetHighlight,
			click: zoomToFeature
		});
	}

	geojson = L.geoJson(statesData, {
		style: style,
		onEachFeature: onEachFeature
	}).addTo(map);

这样在悬停时状态可以很好地被突出显示，并且我们可以在监听器中添加其他交互功能。

### 自定义信息控制

我们可以在点击时使用常规的弹出窗口来显示关于不同状态的信息，但我们将选择另一种方式——在状态悬停时通过[自定义控制](/reference.html#控件)显示信息。

这是我们的控制的代码：

	var info = L.control();

	info.onAdd = function (map) {
		this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
		this.update();
		return this._div;
	};

	// method that we will use to update the control based on feature properties passed
	info.update = function (props) {
		this._div.innerHTML = '<h4>US Population Density</h4>' +  (props ?
			'<b>' + props.name + '</b><br />' + props.density + ' people / mi<sup>2</sup>'
			: 'Hover over a state');
	};

	info.addTo(map);

当用户悬停在状态上时，我们需要更新控制，因此我们也会如下修改监听器：

	function highlightFeature(e) {
		...
		info.update(layer.feature.properties);
	}

	function resetHighlight(e) {
		...
		info.update();
	}

控制还需要一些 CSS 样式以看起来更美观：

{: .css}
	.info {
		padding: 6px 8px;
		font: 14px/16px Arial, Helvetica, sans-serif;
		background: white;
		background: rgba(255,255,255,0.8);
		box-shadow: 0 0 15px rgba(0,0,0,0.2);
		border-radius: 5px;
	}
	.info h4 {
		margin: 0 0 5px;
		color: #777;
	}

### 自定义图例控制

创建带有图例的控制更容易，因为图例是静态的，不会在状态悬停时改变。JavaScript 代码：

	var legend = L.control({position: 'bottomright'});

	legend.onAdd = function (map) {

		var div = L.DomUtil.create('div', 'info legend'),
			grades = [0, 10, 20, 50, 100, 200, 500, 1000],
			labels = [];

		// loop through our density intervals and generate a label with a colored square for each interval
		for (var i = 0; i < grades.length; i++) {
			div.innerHTML +=
				'<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
				grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
		}

		return div;
	};

	legend.addTo(map);

控制的 CSS 样式（我们复用之前定义的 `info` 类）：

{: .css}
	.legend {
		line-height: 18px;
		color: #555;
	}
	.legend i {
		width: 18px;
		height: 18px;
		float: left;
		margin-right: 8px;
		opacity: 0.7;
	}

可以在本页顶部或[单独页面](example.html)上查看结果。
