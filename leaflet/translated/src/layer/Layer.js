import {Evented} from '../core/Events';
import {Map} from '../map/Map';
import * as Util from '../core/Util';

/*
 * @class Layer
 * @inherits Evented
 * @aka L.Layer
 * @aka ILayer
 *
 * 来自 图层 基础类的一系列方法，所有 Leaflet 图层都使用这些方法。
 * 继承 `L.Evented` 中的所有方法、选项和事件。
 *
 * @example
 *
 * ```js
 * var layer = L.marker(latlng).addTo(map);
 * layer.addTo(map);
 * layer.remove();
 * ```
 *
 * @event add: Event
 * 在图层被添加到地图后触发。
 *
 * @event remove: Event
 * 在图层从地图中移除后触发。
 */


export var Layer = Evented.extend({

	// 扩展 `L.Layer` 的类将继承以下选项：
	options: {
		// @option pane: String = 'overlayPane'
		// 默认情况下，图层将被添加到地图的 [叠加窗格](#地图-overlaypane) 中。覆盖此选项则会导致默认情况下图层被放置在另一个窗格中。
		pane: 'overlayPane',

		// @option attribution: String = null
		// 在归属控制中显示的字符串，例如“© OpenStreetMap contributors”。它描述了图层数据，通常是对版权持有者和瓦片提供商的法律义务。
		attribution: null,

		bubblingMouseEvents: true
	},

	/* @section
	 * 扩展 `L.Layer` 的类将继承以下方法：
	 *
	 * @method addTo(map: Map|LayerGroup): this
	 * 将图层添加到指定的地图或图层组。
	 */
	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	// @method remove: this
	// 从当前激活的地图中移除图层。
	remove: function () {
		return this.removeFrom(this._map || this._mapToAdd);
	},

	// @method removeFrom(map: Map): this
	// 从指定地图中移除图层。
	//
	// @alternative
	// @method removeFrom(group: LayerGroup): this
	// 从指定的 `LayerGroup` 中移除图层。
	removeFrom: function (obj) {
		if (obj) {
			obj.removeLayer(this);
		}
		return this;
	},

	// @method getPane(name? : String): HTMLElement
	// 返回表示地图上指定窗格的 `HTMLElement`。如果省略 `name` 参数，则返回该图层的窗格。
	getPane: function (name) {
		return this._map.getPane(name ? (this.options[name] || name) : this.options.pane);
	},

	addInteractiveTarget: function (targetEl) {
		this._map._targets[Util.stamp(targetEl)] = this;
		return this;
	},

	removeInteractiveTarget: function (targetEl) {
		delete this._map._targets[Util.stamp(targetEl)];
		return this;
	},

	// @method getAttribution: String
	// 由归属控制使用，返回 [归属选项](#gridlayer-归属信息)。
	getAttribution: function () {
		return this.options.attribution;
	},

	_layerAdd: function (e) {
		var map = e.target;

		// 检查在地图准备就绪之前图层被添加又被移除的情况。
		if (!map.hasLayer(this)) { return; }

		this._map = map;
		this._zoomAnimated = map._zoomAnimated;

		if (this.getEvents) {
			var events = this.getEvents();
			map.on(events, this);
			this.once('remove', function () {
				map.off(events, this);
			}, this);
		}

		this.onAdd(map);

		this.fire('add');
		map.fire('layeradd', {layer: this});
	}
});

/* @section Extension methods
 * @uninheritable
 *
 * 每个图层都应扩展自 `L.Layer` 并（重新）实现以下方法。
 *
 * @method onAdd(map: Map): this
 * 应包含用于创建图层 DOM 元素、将其添加到应位于的 [地图窗格] 以及为相关地图事件添加监听器的代码。在 [`map.addLayer(layer)`](#地图-addlayer) 中调用。
 *
 * @method onRemove(map: Map): this
 * 应包含所有清理代码，用于从 DOM 中移除图层的元素以及在 [`onAdd`](#图层-onadd) 中移除之前添加的监听器。在 [`map.removeLayer(layer)`](#地图-removelayer) 中调用。
 *
 * @method getEvents(): Object
 * 此可选方法应返回类似 `{ viewreset: this._reset }` 的对象，用于 [`addEventListener`](#evented-addeventlistener)。该对象中的事件处理程序将自动随图层一起添加到地图中并移除。
 *
 * @method getAttribution(): String
 * 此可选方法应返回一个字符串，包含当图层可见时应在 [归属控制] 中显示的 HTML。
 *
 * @method beforeAdd(map: Map): this
 * 可选方法。在地图层被添加到地图之前，事件初始化之前调用，无需等待地图进入可用状态。仅用于早期初始化阶段。
 */


/* @namespace Map
 * @section Layer events
 *
 * @event layeradd: LayerEvent
 * 当新层被添加到地图时触发。
 *
 * @event layerremove: LayerEvent
 * 当某个层从地图中移除时触发。
 *
 * @section Methods for Layers and Controls
 */
Map.include({
	// @method addLayer(layer: Layer): this
	// 将给定层添加到地图中。
	addLayer: function (layer) {
		if (!layer._layerAdd) {
			throw new Error('The provided object is not a Layer.');
		}

		var id = Util.stamp(layer);
		if (this._layers[id]) { return this; }
		this._layers[id] = layer;

		layer._mapToAdd = this;

		if (layer.beforeAdd) {
			layer.beforeAdd(this);
		}

		this.whenReady(layer._layerAdd, layer);

		return this;
	},

	// @method removeLayer(layer: Layer): this
	// 从地图中移除给定层。
	removeLayer: function (layer) {
		var id = Util.stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer: layer});
			layer.fire('remove');
		}

		layer._map = layer._mapToAdd = null;

		return this;
	},

	// @method hasLayer(layer: Layer): Boolean
	// 如果给定层当前已添加到地图，则返回 `true`。
	hasLayer: function (layer) {
		return Util.stamp(layer) in this._layers;
	},

	/* @method eachLayer(fn: Function, context?: Object): this
	 * 遍历地图中的各层，可指定迭代器的上下文。
	 * ```
	 * 地图.eachLayer(function(图层){
	 * 图层.bindPopup('Hello');
	 * });
	 * ```
	 */
	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	_addLayers: function (layers) {
		layers = layers ? (Util.isArray(layers) ? layers : [layers]) : [];

		for (var i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},

	_addZoomLimit: function (layer) {
		if (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
			this._zoomBoundLayers[Util.stamp(layer)] = layer;
			this._updateZoomLevels();
		}
	},

	_removeZoomLimit: function (layer) {
		var id = Util.stamp(layer);

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}
	},

	_updateZoomLevels: function () {
		var minZoom = Infinity,
		    maxZoom = -Infinity,
		    oldZoomSpan = this._getZoomSpan();

		for (var i in this._zoomBoundLayers) {
			var options = this._zoomBoundLayers[i].options;

			minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
			maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
		}

		this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
		this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;

		// @section Map state change events
		// @event zoomlevelschange: Event
		// 当地图上的缩放级别因添加或移除层而发生变化时触发。
		// 
		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}

		if (this.options.maxZoom === undefined && this._layersMaxZoom && this.getZoom() > this._layersMaxZoom) {
			this.setZoom(this._layersMaxZoom);
		}
		if (this.options.minZoom === undefined && this._layersMinZoom && this.getZoom() < this._layersMinZoom) {
			this.setZoom(this._layersMinZoom);
		}
	}
});
