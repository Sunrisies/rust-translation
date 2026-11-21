---
layout: tutorial_v2
title: 带有自定义图标的标记器
---

## 带有自定义图标的标记器

在本教程中，你将学习如何轻松地为地图上的标记器定义自己的图标。

{% include frame.html url="example.html" %}

### 准备图像

要创建自定义图标，通常需要两张图片——实际图标图片及其阴影图片。本教程中，我们采用了 Leaflet 徽标并从中生成了四张图片：三张不同颜色的叶子图片和一张用于三个图标的阴影图片。

<p>
	<img style="border: 1px solid #ccc" src="leaf-green.png" />
	<img style="border: 1px solid #ccc" src="leaf-red.png" />
	<img style="border: 1px solid #ccc" src="leaf-orange.png" />
	<img style="border: 1px solid #ccc" src="leaf-shadow.png" />
</p>

请注意，图片中的白色区域实际上是透明的。

### 创建图标

Leaflet 中的标记器图标由 [L.Icon](/reference.html#icon) 对象定义，在创建标记器时作为选项传递。让我们创建一个绿色叶子图标：

	var greenIcon = L.icon({
		iconUrl: 'leaf-green.png',
		shadowUrl: 'leaf-shadow.png',

		iconSize:     [38, 95], // size of the icon
		shadowSize:   [50, 64], // size of the shadow
		iconAnchor:   [22, 94], // point of the icon which will correspond to marker's location
		shadowAnchor: [4, 62],  // the same for the shadow
		popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
	});

现在使用这个图标在地图上放置标记器变得简单了：

	L.marker([51.5, -0.09], {icon: greenIcon}).addTo(map);

{% include frame.html url="example-one-icon.html" %}

### 定义图标类

如果我们需要创建多个具有共同特征的图标呢？让我们定义一个包含共享选项的自定义图标类，该类从 `L.Icon` 继承！在 Leaflet 中这非常容易：

	var LeafIcon = L.Icon.extend({
		options: {
			shadowUrl: 'leaf-shadow.png',
			iconSize:     [38, 95],
			shadowSize:   [50, 64],
			iconAnchor:   [22, 94],
			shadowAnchor: [4, 62],
			popupAnchor:  [-3, -76]
		}
	});

现在我们可以从这个类创建所有三个叶子图标并使用它们：

	var greenIcon = new LeafIcon({iconUrl: 'leaf-green.png'}),
		redIcon = new LeafIcon({iconUrl: 'leaf-red.png'}),
		orangeIcon = new LeafIcon({iconUrl: 'leaf-orange.png'});

你可能注意到我们在创建 LeafIcon 实例时使用了 `new` 关键字。那么为什么所有 Leaflet 类都无需使用 `new` 就能创建呢？答案很简单：真正的 Leaflet 类以大写字母命名（例如 `L.Icon`），并且也需要用 `new` 来创建，但也有一些小写的名称快捷方式（`L.icon`）用于方便操作：

	L.icon = function (options) {
		return new L.Icon(options);
	};

你也可以对你的类进行同样的操作。好了，最后让我们在地图上使用这些图标放置一些标记器吧：

	L.marker([51.5, -0.09], {icon: greenIcon}).addTo(map).bindPopup("I am a green leaf.");
	L.marker([51.495, -0.083], {icon: redIcon}).addTo(map).bindPopup("I am a red leaf.");
	L.marker([51.49, -0.1], {icon: orangeIcon}).addTo(map).bindPopup("I am an orange leaf.");

就是这样。现在可以查看 [完整示例](example.html)、[`L.Icon` 文档](/reference.html#icon)，或浏览 [其他示例](../../examples.html)。
