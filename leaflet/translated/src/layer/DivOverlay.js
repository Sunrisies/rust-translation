import {Map} from '../map/Map';
import {Layer} from './Layer';
import {FeatureGroup} from './FeatureGroup';
import * as Util from '../core/Util';
import {toLatLng, LatLng} from '../geo/LatLng';
import {toPoint} from '../geometry/Point';
import * as DomUtil from '../dom/DomUtil';

/*
 * @class DivOverlay
 * @inherits Interactive layer
 * @aka L.DivOverlay
 * L.弹出窗口 和 L.工具提示 的基础模型。用于自定义覆盖层，可从中继承。
 */

// @namespace DivOverlay
export var DivOverlay = Layer.extend({

	// @section
	// @aka DivOverlay options
	options: {
		// @option interactive: Boolean = false
		// 如果为 true，则弹出框/工具提示将监听鼠标事件。
		interactive: false,

		// @option offset: Point = Point(0, 0)
		// 覆盖层位置的偏移量。
		offset: [0, 0],

		// @option className: String = ''
		// 分配给覆盖层的自定义 CSS 类名。
		className: '',

		// @option pane: String = undefined
		// 添加覆盖层的 `Map pane`。
		pane: undefined,

		// @option content: String|HTMLElement|Function = ''
		// 在初始化时设置覆盖层的 HTML 内容。如果传递了函数，则源图层将被传递给该函数。该函数应返回用于覆盖层的 `String` 或 `HTMLElement`。
		// passed to the function. The function should return a `String` or `HTMLElement` to be used in the overlay.
		content: ''
	},

	initialize: function (options, source) {
		if (options && (options instanceof LatLng || Util.isArray(options))) {
			this._latlng = toLatLng(options);
			Util.setOptions(this, source);
		} else {
			Util.setOptions(this, options);
			this._source = source;
		}
		if (this.options.content) {
			this._content = this.options.content;
		}
	},

	// @method openOn(map: Map): this
	// 将覆盖层添加到地图中。
	// `map.openPopup(popup)`/`.openTooltip(tooltip)` 的替代方案。
	openOn: function (map) {
		map = arguments.length ? map : this._source._map; // experimental, not the part of public api
		if (!map.hasLayer(this)) {
			map.addLayer(this);
		}
		return this;
	},

	// @method close(): this
	// 关闭覆盖层。
	// `map.closePopup(popup)`/`.closeTooltip(tooltip)` 的替代方案。
	// 以及 `layer.closePopup()`/`.closeTooltip()`。
	close: function () {
		if (this._map) {
			this._map.removeLayer(this);
		}
		return this;
	},

	// @method toggle(layer?: Layer): this
	// 根据当前状态打开或关闭与图层绑定的覆盖层。
	// 仅对于与图层绑定的覆盖层，可以省略参数。
	// `layer.togglePopup()`/`.toggleTooltip()` 的替代方案。
	toggle: function (layer) {
		if (this._map) {
			this.close();
		} else {
			if (arguments.length) {
				this._source = layer;
			} else {
				layer = this._source;
			}
			this._prepareOpen();

			// 在地图上打开覆盖层。
			this.openOn(layer._map);
		}
		return this;
	},

	onAdd: function (map) {
		this._zoomAnimated = map._zoomAnimated;

		if (!this._container) {
			this._initLayout();
		}

		if (map._fadeAnimated) {
			DomUtil.setOpacity(this._container, 0);
		}

		clearTimeout(this._removeTimeout);
		this.getPane().appendChild(this._container);
		this.update();

		if (map._fadeAnimated) {
			DomUtil.setOpacity(this._container, 1);
		}

		this.bringToFront();

		if (this.options.interactive) {
			DomUtil.addClass(this._container, 'leaflet-interactive');
			this.addInteractiveTarget(this._container);
		}
	},

	onRemove: function (map) {
		if (map._fadeAnimated) {
			DomUtil.setOpacity(this._container, 0);
			this._removeTimeout = setTimeout(Util.bind(DomUtil.remove, undefined, this._container), 200);
		} else {
			DomUtil.remove(this._container);
		}

		if (this.options.interactive) {
			DomUtil.removeClass(this._container, 'leaflet-interactive');
			this.removeInteractiveTarget(this._container);
		}
	},

	// @namespace DivOverlay
	// @method getLatLng: LatLng
	// 返回覆盖层的地理坐标点。
	getLatLng: function () {
		return this._latlng;
	},

	// @method setLatLng(latlng: LatLng): this
	// 设置覆盖层打开时的地理坐标点。
	setLatLng: function (latlng) {
		this._latlng = toLatLng(latlng);
		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}
		return this;
	},

	// @method getContent: String|HTMLElement
	// 返回覆盖层的内容。
	getContent: function () {
		return this._content;
	},

	// @method setContent(htmlContent: String|HTMLElement|Function): this
	// 设置覆盖层的 HTML 内容。如果传递了函数，则源图层将被传递给该函数。
	// 该函数应返回用于覆盖层的 `String` 或 `HTMLElement`。
	setContent: function (content) {
		this._content = content;
		this.update();
		return this;
	},

	// @method getElement: String|HTMLElement
	// 返回覆盖层的 HTML 容器。
	getElement: function () {
		return this._container;
	},

	// @method update: null
	// 更新覆盖层的内容、布局和位置。适用于在内部内容发生变化后更新覆盖层，例如图像加载后。
	update: function () {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	},

	getEvents: function () {
		var events = {
			zoom: this._updatePosition,
			viewreset: this._updatePosition
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}
		return events;
	},

	// @method isOpen: Boolean
	// 当覆盖层在地图上可见时返回 `true`。
	isOpen: function () {
		return !!this._map && this._map.hasLayer(this);
	},

	// @method bringToFront: this
	// 将此覆盖层置于同一地图窗格中的其他覆盖层之前。
	bringToFront: function () {
		if (this._map) {
			DomUtil.toFront(this._container);
		}
		return this;
	},

	// @method bringToBack: this
	// 将此覆盖层置于同一地图窗格中的其他覆盖层之后。
	bringToBack: function () {
		if (this._map) {
			DomUtil.toBack(this._container);
		}
		return this;
	},

	// 准备打开的绑定覆盖层：更新 latlng 位置/内容源（针对 FeatureGroup）。
	_prepareOpen: function (latlng) {
		var source = this._source;
		if (!source._map) { return false; }

		if (source instanceof FeatureGroup) {
			source = null;
			var layers = this._source._layers;
			for (var id in layers) {
				if (layers[id]._map) {
					source = layers[id];
					break;
				}
			}
			if (!source) { return false; } // Unable to get source layer.

			// 将覆盖层源设置为该图层。
			this._source = source;
		}

		if (!latlng) {
			if (source.getCenter) {
				latlng = source.getCenter();
			} else if (source.getLatLng) {
				latlng = source.getLatLng();
			} else if (source.getBounds) {
				latlng = source.getBounds().getCenter();
			} else {
				throw new Error('Unable to get source layer LatLng.');
			}
		}
		this.setLatLng(latlng);

		if (this._map) {
			// 更新覆盖层（内容、布局等...）。
			this.update();
		}

		return true;
	},

	_updateContent: function () {
		if (!this._content) { return; }

		var node = this._contentNode;
		var content = (typeof this._content === 'function') ? this._content(this._source || this) : this._content;

		if (typeof content === 'string') {
			node.innerHTML = content;
		} else {
			while (node.hasChildNodes()) {
				node.removeChild(node.firstChild);
			}
			node.appendChild(content);
		}

		// @namespace DivOverlay
		// @section DivOverlay events
		// @event contentupdate: Event
		// 当覆盖层内容更新时触发。
		this.fire('contentupdate');
	},

	_updatePosition: function () {
		if (!this._map) { return; }

		var pos = this._map.latLngToLayerPoint(this._latlng),
		    offset = toPoint(this.options.offset),
		    anchor = this._getAnchor();

		if (this._zoomAnimated) {
			DomUtil.setPosition(this._container, pos.add(anchor));
		} else {
			offset = offset.add(pos).add(anchor);
		}

		var bottom = this._containerBottom = -offset.y,
		    left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;

		// 如果覆盖层高度发生变化（例如图像加载），则将其置于底部位置。
		this._container.style.bottom = bottom + 'px';
		this._container.style.left = left + 'px';
	},

	_getAnchor: function () {
		return [0, 0];
	}

});

Map.include({
	_initOverlay: function (OverlayClass, content, latlng, options) {
		var overlay = content;
		if (!(overlay instanceof OverlayClass)) {
			overlay = new OverlayClass(options).setContent(content);
		}
		if (latlng) {
			overlay.setLatLng(latlng);
		}
		return overlay;
	}
});


Layer.include({
	_initOverlay: function (OverlayClass, old, content, options) {
		var overlay = content;
		if (overlay instanceof OverlayClass) {
			Util.setOptions(overlay, options);
			overlay._source = this;
		} else {
			overlay = (old && !options) ? old : new OverlayClass(options, this);
			overlay.setContent(content);
		}
		return overlay;
	}
});
