import {LayerGroup} from './LayerGroup';
import {LatLngBounds} from '../geo/LatLngBounds';

/*
 * @class FeatureGroup
 * @aka L.FeatureGroup
 * @inherits LayerGroup
 *
 * 扩展的 `LayerGroup`，便于对所有成员层执行相同的操作：
 * [`bindPopup`](#图层-bindpopup) 可一次性将弹出窗口绑定到所有层（与 [`bindTooltip`](#图层-bindtooltip）类似）
 * 事件会传播到 `FeatureGroup`，因此如果该组有事件处理器，它将处理来自任何层的事件。这包括鼠标事件和自定义事件。
 * handler, it will handle events from any of the layers. This includes mouse events
 * and custom events.
 * 包含 `layeradd` 和 `layerremove` 事件
 *
 * @example
 *
 * ```js
 * L.featureGroup([marker1, marker2, polyline])
 * 	.bindPopup('Hello world!')
 * 	.on('click', function() { alert('Clicked on a member of the group!'); })
 * 	.addTo(map);
 * ```
 */

export var FeatureGroup = LayerGroup.extend({

	addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		layer.addEventParent(this);

		LayerGroup.prototype.addLayer.call(this, layer);

		// @event layeradd: LayerEvent
		// 当一层被添加到此 `FeatureGroup` 时触发
		return this.fire('layeradd', {layer: layer});
	},

	removeLayer: function (layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (layer in this._layers) {
			layer = this._layers[layer];
		}

		layer.removeEventParent(this);

		LayerGroup.prototype.removeLayer.call(this, layer);

		// @event layerremove: LayerEvent
		// 当一层从此 `FeatureGroup` 被移除时触发
		return this.fire('layerremove', {layer: layer});
	},

	// @method setStyle(style: Path options): this
	// 为具有 `setStyle` 方法的组中的每层设置给定的路径选项
	setStyle: function (style) {
		return this.invoke('setStyle', style);
	},

	// @method bringToFront(): this
	// 将层组置于所有其他层的顶部
	bringToFront: function () {
		return this.invoke('bringToFront');
	},

	// @method bringToBack(): this
	// 将层组置于所有其他层的底部
	bringToBack: function () {
		return this.invoke('bringToBack');
	},

	// @method getBounds(): LatLngBounds
	// 返回 `FeatureGroup` 的 LatLngBounds（由其子元素的边界和坐标生成）
	getBounds: function () {
		var bounds = new LatLngBounds();

		for (var id in this._layers) {
			var layer = this._layers[id];
			bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
		}
		return bounds;
	}
});

// @factory L.featureGroup(layers?: Layer[], options?: Object)
// 创建一个 `FeatureGroup`，可指定初始层集和 `options` 对象。
export var featureGroup = function (layers, options) {
	return new FeatureGroup(layers, options);
};
