---
layout: tutorial_v2
title: 扩展 Leaflet：新的处理程序和控制元素
---

<br>

本教程假设您已阅读[Leaflet 类继承理论](./extending-1-classes.html)。

在 Leaflet 中，“层”指的是任何随地图移动的元素。相反地，“控制元素”是相对于地图容器保持静态的 HTML 元素，而“处理程序”则是改变地图行为的不可见代码。

## Handlers

地图处理程序是 Leaflet 1.0 中的一个新概念，其功能是处理来自浏览器的 DOM 事件（如 `click`、`dblclick` 或 `mousewheel`），并改变地图的状态。

处理程序相对简单：它们只需要一个 `addHooks()` 方法（当处理程序在地图上被启用时调用）和一个 `removeHooks()` 方法（当处理程序被禁用时调用）。处理程序的骨架如下：

	L.CustomHandler = L.Handler.extend({
		addHooks: function() {
			L.DomEvent.on(document, 'eventname', this._doSomething, this);
		},

		removeHooks: function() {
			L.DomEvent.off(document, 'eventname', this._doSomething, this);
		},

		_doSomething: function(event) { … }
	});

可以通过一个简单的处理程序来演示如何在移动设备倾斜时旋转地图，通过 [`deviceorientation` 事件](https://developer.mozilla.org/en-US/docs/Web/API/Detecting_device_orientation)实现：

	L.TiltHandler = L.Handler.extend({
		addHooks: function() {
			L.DomEvent.on(window, 'deviceorientation', this._tilt, this);
		},

		removeHooks: function() {
			L.DomEvent.off(window, 'deviceorientation', this._tilt, this);
		},

		_tilt: function(ev) {
			// Treat Gamma angle as horizontal pan (1 degree = 1 pixel) and Beta angle as vertical pan
			this._map.panBy( L.point( ev.gamma, ev.beta ) );
		}
	});

可以使用 `map.addHandler('tilt', L.TiltHandler)` 将处理程序附加到地图上——这样会将 `L.TiltHandler` 的实例存储为 `map.tilt`。不过，通常更常见的是使用 `addInitHook` 语法将所有地图附加处理程序。

	L.Map.addInitHook('addHandler', 'tilt', L.TiltHandler);

现在，可以通过运行 `map.tilt.enable()` 来启用处理程序，通过 `map.tilt.disable()` 来禁用它。

此外，如果地图具有与处理程序相同的名称属性，并且该选项为 `true`，则处理程序将默认被启用，因此我们的处理程序将默认处于启用状态：

	var map = L.map('mapDiv', { tilt: true });

要查看此示例，您需要一个支持 [`deviceorientation` 事件](http://caniuse.com/#search=deviceOrientation) 的移动浏览器——即便如此，该事件也特别不稳定且定义不明确，因此需要小心。

{% include frame.html url="tilt.html" %}

根据事件类型，地图处理程序可以将事件监听器附加到 `document`、`window` 或所附加的 `L.Map` 容器上。

## Controls

您已经熟悉了控制元素——左上角的缩放控制、左下角的比例控制以及右上角的图层切换器。本质上，`L.Control`是一个位于地图容器中的静态位置的 HTML 元素。

要创建控制元素，只需从 `L.Control` 继承并重写 `onAdd()` 和 `onRemove()` 方法。这些方法的运作方式与其对应的 `L.Layer` 类似（当控制元素被添加到或移除地图时就会执行），不同之处在于 `onAdd()` 必须返回一个表示该控制的 `HTMLElement` 实例。将元素添加到地图中以及从地图中移除它都是自动完成的。

最简单的自定义控制示例就是水印，即一个图片：

	L.Control.Watermark = L.Control.extend({
		onAdd: function(map) {
			var img = L.DomUtil.create('img');

			img.src = '../../docs/images/logo.png';
			img.style.width = '200px';

			return img;
		},

		onRemove: function(map) {
			// Nothing to do here
		}
	});

	L.control.watermark = function(opts) {
		return new L.Control.Watermark(opts);
	}

	L.control.watermark({ position: 'bottomleft' }).addTo(map);

{% include frame.html url="watermark.html" %}

如果您的自定义控制包含可交互元素，如可点击按钮，请确保在 `onAdd()` 中使用 `L.DomEvent.on()`，在 `onRemove()` 中使用 `L.DomEvent.off()`。

如果您的自定义控制由多个 HTML 元素组成（例如具有两个按钮的 `L.Control.Zoom`），则您需要创建整个元素层次结构，并返回最顶层的容器。

## 发布您的插件

如果您已经理解了所有内容，那么就可以开始制作 Leaflet 插件了！但请务必阅读 [`PLUGIN-GUIDE.md` 文件](https://github.com/Leaflet/Leaflet/blob/main/PLUGIN-GUIDE.md)，其中包含了关于命名和发布插件的建议与最佳实践。
