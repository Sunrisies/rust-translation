
import {Layer} from './Layer';
import * as Util from '../core/Util';

/*
 * @class LayerGroup
 * @aka L.LayerGroup
 * @inherits Interactive layer
 *
 * 用于将多个图层组合在一起处理。如果将其添加到地图中，
 * 该组中添加或移除的任何图层都将在地图上被添加/移除，
 * 从而扩展 `Layer` 类。
 *
 * @example
 *
 * ```js
 * L.layerGroup([marker1, marker2])
 * 	.addLayer(polyline)
 * 	.addTo(map);
 * ```
 */

export var LayerGroup = Layer.extend({

	initialize: function (layers, options) {
		Util.setOptions(this, options);

		this._layers = {};

		var i, len;

		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	},

	// @method addLayer(layer: Layer): this
	// 将指定的图层加入组中。
	addLayer: function (layer) {
		var id = this.getLayerId(layer);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this;
	},

	// @method removeLayer(layer: Layer): this
	// 从组中移除指定的图层。
	// @alternative
	// @method removeLayer(id: Number): this
	// 根据给定的内部 ID 从组中移除该图层。
	removeLayer: function (layer) {
		var id = layer in this._layers ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	},

	// @method hasLayer(layer: Layer): Boolean
	// 如果指定的图层当前在组中，则返回 `true`。
	// @alternative
	// @method hasLayer(id: Number): Boolean
	// 如果给定的内部 ID 当前在组中，则返回 `true`。
	hasLayer: function (layer) {
		var layerId = typeof layer === 'number' ? layer : this.getLayerId(layer);
		return layerId in this._layers;
	},

	// @method clearLayers(): this
	// 从组中移除所有图层。
	clearLayers: function () {
		return this.eachLayer(this.removeLayer, this);
	},

	// @method invoke(methodName: String, …): this
	// 对组中的每个图层调用 `methodName` 方法，并传递任意额外参数。如果包含的图层未实现 `methodName`，则无效果。
	// additional parameters. Has no effect if the layers contained do not
	// implement `methodName`.
	invoke: function (methodName) {
		var args = Array.prototype.slice.call(arguments, 1),
		    i, layer;

		for (i in this._layers) {
			layer = this._layers[i];

			if (layer[methodName]) {
				layer[methodName].apply(layer, args);
			}
		}

		return this;
	},

	onAdd: function (map) {
		this.eachLayer(map.addLayer, map);
	},

	onRemove: function (map) {
		this.eachLayer(map.removeLayer, map);
	},

	// @method eachLayer(fn: Function, context?: Object): this
	// 遍历组的各层，可指定迭代器的上下文。
	// ```js
	// group.eachLayer(function (图层) {
	// 图层.bindPopup('Hello');
	// });
	// ```
	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	// @method getLayer(id: Number): Layer
	// 返回具有给定内部 ID 的图层。
	getLayer: function (id) {
		return this._layers[id];
	},

	// @method getLayers(): Layer[]
	// 返回加入组中的所有图层的数组。
	getLayers: function () {
		var layers = [];
		this.eachLayer(layers.push, layers);
		return layers;
	},

	// @method setZIndex(zIndex: Number): this
	// 对组中的每个图层调用 `setZIndex` 方法，并传递 z-index 值。
	setZIndex: function (zIndex) {
		return this.invoke('setZIndex', zIndex);
	},

	// @method getLayerId(layer: Layer): Number
	// 返回图层的内部 ID。
	getLayerId: function (layer) {
		return Util.stamp(layer);
	}
});


// @factory L.layerGroup(layers?: Layer[], options?: Object)
// 创建图层组，可指定初始图层集合和 `options` 对象。
export var layerGroup = function (layers, options) {
	return new LayerGroup(layers, options);
};
