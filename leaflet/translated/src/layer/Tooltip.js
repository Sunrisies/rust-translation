import {DivOverlay} from './DivOverlay';
import {toPoint} from '../geometry/Point';
import {Map} from '../map/Map';
import {Layer} from './Layer';
import * as DomUtil from '../dom/DomUtil';
import * as DomEvent from '../dom/DomEvent';
import * as Util from '../core/Util';
import {FeatureGroup} from './FeatureGroup';

/*
 * @class Tooltip
 * @inherits DivOverlay
 * @aka L.Tooltip
 * 用于在地图图层上方显示小文本。
 *
 * @example
 * If you want to just bind a tooltip to marker:
 *
 * ```js
 * marker.bindTooltip("my tooltip text").openTooltip();
 * ```
 * Path overlays like polylines also have a `bindTooltip` method.
 *
 * A tooltip can be also standalone:
 *
 * ```js
 * var tooltip = L.tooltip()
 * 	.setLatLng(latlng)
 * 	.setContent('Hello world!<br />This is a nice tooltip.')
 * 	.addTo(map);
 * ```
 * or
 * ```js
 * var tooltip = L.tooltip(latlng, {content: 'Hello world!<br />This is a nice tooltip.'})
 * 	.addTo(map);
 * ```
 *
 *
 * Note about tooltip offset. Leaflet takes two options in consideration
 * for computing tooltip offsetting:
 * - the `offset` Tooltip option: it defaults to [0, 0], and it's specific to one tooltip.
 *   Add a positive x offset to move the tooltip to the right, and a positive y offset to
 *   move it to the bottom. Negatives will move to the left and top.
 * - the `tooltipAnchor` Icon option: this will only be considered for Marker. You
 *   should adapt this value if you use a custom icon.
 */


// @namespace Tooltip
export var Tooltip = DivOverlay.extend({

	// @section
	// @aka Tooltip options
	options: {
		// @option pane: String = 'tooltipPane'
		// `Map pane`，即提示框将在此处添加的位置。
		pane: 'tooltipPane',

		// @option offset: Point = Point(0, 0)
		// 提示框位置的可选偏移量。
		offset: [0, 0],

		// @option direction: String = 'auto'
		// 打开提示框的方向。可能的值包括：`right`、`left`、`top`、`bottom`、`center` 或 `auto`。
		// `top`、`bottom`、`center` 或 `auto`。
		// `auto` 模式会根据地图上的位置动态在 `right` 和 `left` 之间切换。
		// 地图上的位置。
		direction: 'auto',

		// @option permanent: Boolean = false
		// 是否永久打开提示框，还是仅在鼠标悬停时显示。
		permanent: false,

		// @option sticky: Boolean = false
		// 如果设置为真，提示框将跟随鼠标移动，而不是固定在特征中心。
		sticky: false,

		// @option opacity: Number = 0.9
		// 提示框容器的透明度。
		opacity: 0.9
	},

	onAdd: function (map) {
		DivOverlay.prototype.onAdd.call(this, map);
		this.setOpacity(this.options.opacity);

		// @namespace Map
		// @section Tooltip events
		// @event tooltipopen: TooltipEvent
		// 在地图中打开提示框时触发此事件。
		map.fire('tooltipopen', {tooltip: this});

		if (this._source) {
			this.addEventParent(this._source);

			// @namespace Layer
			// @section Tooltip events
			// @event tooltipopen: TooltipEvent
			// 绑定到此图层的提示框被打开时触发此事件。
			this._source.fire('tooltipopen', {tooltip: this}, true);
		}
	},

	onRemove: function (map) {
		DivOverlay.prototype.onRemove.call(this, map);

		// @namespace Map
		// @section Tooltip events
		// @event tooltipclose: TooltipEvent
		// 地图中的提示框关闭时触发此事件。
		map.fire('tooltipclose', {tooltip: this});

		if (this._source) {
			this.removeEventParent(this._source);

			// @namespace Layer
			// @section Tooltip events
			// @event tooltipclose: TooltipEvent
			// 绑定到此图层的提示框关闭时触发此事件。
			this._source.fire('tooltipclose', {tooltip: this}, true);
		}
	},

	getEvents: function () {
		var events = DivOverlay.prototype.getEvents.call(this);

		if (!this.options.permanent) {
			events.preclick = this.close;
		}

		return events;
	},

	_initLayout: function () {
		var prefix = 'leaflet-tooltip',
		    className = prefix + ' ' + (this.options.className || '') + ' leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

		this._contentNode = this._container = DomUtil.create('div', className);

		this._container.setAttribute('role', 'tooltip');
		this._container.setAttribute('id', 'leaflet-tooltip-' + Util.stamp(this));
	},

	_updateLayout: function () {},

	_adjustPan: function () {},

	_setPosition: function (pos) {
		var subX, subY,
		    map = this._map,
		    container = this._container,
		    centerPoint = map.latLngToContainerPoint(map.getCenter()),
		    tooltipPoint = map.layerPointToContainerPoint(pos),
		    direction = this.options.direction,
		    tooltipWidth = container.offsetWidth,
		    tooltipHeight = container.offsetHeight,
		    offset = toPoint(this.options.offset),
		    anchor = this._getAnchor();

		if (direction === 'top') {
			subX = tooltipWidth / 2;
			subY = tooltipHeight;
		} else if (direction === 'bottom') {
			subX = tooltipWidth / 2;
			subY = 0;
		} else if (direction === 'center') {
			subX = tooltipWidth / 2;
			subY = tooltipHeight / 2;
		} else if (direction === 'right') {
			subX = 0;
			subY = tooltipHeight / 2;
		} else if (direction === 'left') {
			subX = tooltipWidth;
			subY = tooltipHeight / 2;
		} else if (tooltipPoint.x < centerPoint.x) {
			direction = 'right';
			subX = 0;
			subY = tooltipHeight / 2;
		} else {
			direction = 'left';
			subX = tooltipWidth + (offset.x + anchor.x) * 2;
			subY = tooltipHeight / 2;
		}

		pos = pos.subtract(toPoint(subX, subY, true)).add(offset).add(anchor);

		DomUtil.removeClass(container, 'leaflet-tooltip-right');
		DomUtil.removeClass(container, 'leaflet-tooltip-left');
		DomUtil.removeClass(container, 'leaflet-tooltip-top');
		DomUtil.removeClass(container, 'leaflet-tooltip-bottom');
		DomUtil.addClass(container, 'leaflet-tooltip-' + direction);
		DomUtil.setPosition(container, pos);
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		this._setPosition(pos);
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._container) {
			DomUtil.setOpacity(this._container, opacity);
		}
	},

	_animateZoom: function (e) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
		this._setPosition(pos);
	},

	_getAnchor: function () {
		// 提示框应在源图层上如何定位？
		return toPoint(this._source && this._source._getTooltipAnchor && !this.options.sticky ? this._source._getTooltipAnchor() : [0, 0]);
	}

});

// @namespace Tooltip
// @factory L.tooltip(options?: Tooltip options, source?: Layer)
// 根据可选的 `options` 对象创建 `Tooltip` 对象，该对象描述其外观和位置；同时需要传入可选的 `source` 对象来标记提示框所引用的图层。
// @alternative
// @factory L.tooltip(latlng: LatLng, options?: Tooltip options)
// 根据 `latlng` 位置和可选的 `options` 对象创建 `Tooltip` 对象，用于打开提示框。
export var tooltip = function (options, source) {
	return new Tooltip(options, source);
};

// @namespace Map
// @section Methods for Layers and Controls
Map.include({

	// @method openTooltip(tooltip: Tooltip): this
	// 打开指定的提示框。
	// @alternative
	// @method openTooltip(content: String|HTMLElement, latlng: LatLng, options?: Tooltip options): this
	// 创建具有指定内容和选项的提示框并打开它。
	openTooltip: function (tooltip, latlng, options) {
		this._initOverlay(Tooltip, tooltip, latlng, options)
		  .openOn(this);

		return this;
	},

	// @method closeTooltip(tooltip: Tooltip): this
	// 关闭作为参数传递的提示框。
	closeTooltip: function (tooltip) {
		tooltip.close();
		return this;
	}

});

/*
 * @namespace Layer
 * @section Tooltip methods example
 *
 * 所有图层都拥有一些方便绑定提示框的方法。
 *
 * ```js
 * var layer = L.Polygon(latlngs).bindTooltip('Hi There!').addTo(map);
 * 图层.openTooltip();
 * 图层.closeTooltip();
 * ```
 */

// @section Tooltip methods
Layer.include({

	// @method bindTooltip(content: String|HTMLElement|Function|Tooltip, options?: Tooltip options): this
	// 将提示框绑定到该图层，并设置必要的事件监听器。如果传入了 `Function` 类型参数，则该函数应接受
	// 图层作为第一个参数，并且返回 `String` 或 `HTMLElement` 类型的值。
	// the 图层 as the first argument and should return a `String` or `HTMLElement`.
	bindTooltip: function (content, options) {

		if (this._tooltip && this.isTooltipOpen()) {
			this.unbindTooltip();
		}

		this._tooltip = this._initOverlay(Tooltip, this._tooltip, content, options);
		this._initTooltipInteractions();

		if (this._tooltip.options.permanent && this._map && this._map.hasLayer(this)) {
			this.openTooltip();
		}

		return this;
	},

	// @method unbindTooltip(): this
	// 移除之前通过 `bindTooltip` 绑定的提示框。
	unbindTooltip: function () {
		if (this._tooltip) {
			this._initTooltipInteractions(true);
			this.closeTooltip();
			this._tooltip = null;
		}
		return this;
	},

	_initTooltipInteractions: function (remove) {
		if (!remove && this._tooltipHandlersAdded) { return; }
		var onOff = remove ? 'off' : 'on',
		    events = {
			remove: this.closeTooltip,
			move: this._moveTooltip
		    };
		if (!this._tooltip.options.permanent) {
			events.mouseover = this._openTooltip;
			events.mouseout = this.closeTooltip;
			events.click = this._openTooltip;
			if (this._map) {
				this._addFocusListeners();
			} else {
				events.add = this._addFocusListeners;
			}
		} else {
			events.add = this._openTooltip;
		}
		if (this._tooltip.options.sticky) {
			events.mousemove = this._moveTooltip;
		}
		this[onOff](events);
		this._tooltipHandlersAdded = !remove;
	},

	// @method openTooltip(latlng?: LatLng): this
	// 在指定的 `latlng` 位置打开绑定的提示框；如果未提供 `latlng`，则使用默认的锚点。
	openTooltip: function (latlng) {
		if (this._tooltip) {
			if (!(this instanceof FeatureGroup)) {
				this._tooltip._source = this;
			}
			if (this._tooltip._prepareOpen(latlng)) {
				// 在地图上打开提示框。
				this._tooltip.openOn(this._map);

				if (this.getElement) {
					this._setAriaDescribedByOnLayer(this);
				} else if (this.eachLayer) {
					this.eachLayer(this._setAriaDescribedByOnLayer, this);
				}
			}
		}
		return this;
	},

	// @method closeTooltip(): this
	// 如果绑定到此图层的提示框处于打开状态，则将其关闭。
	closeTooltip: function () {
		if (this._tooltip) {
			return this._tooltip.close();
		}
	},

	// @method toggleTooltip(): this
	// 根据当前状态来打开或关闭绑定到此图层的提示框。
	toggleTooltip: function () {
		if (this._tooltip) {
			this._tooltip.toggle(this);
		}
		return this;
	},

	// @method isTooltipOpen(): boolean
	// 如果绑定到该层的工具提示当前处于打开状态，则返回 `true`。
	isTooltipOpen: function () {
		return this._tooltip.isOpen();
	},

	// @method setTooltipContent(content: String|HTMLElement|Tooltip): this
	// 设置绑定到该层的工具提示内容。
	setTooltipContent: function (content) {
		if (this._tooltip) {
			this._tooltip.setContent(content);
		}
		return this;
	},

	// @method getTooltip(): Tooltip
	// 返回绑定到该层的工具提示。
	getTooltip: function () {
		return this._tooltip;
	},

	_addFocusListeners: function () {
		if (this.getElement) {
			this._addFocusListenersOnLayer(this);
		} else if (this.eachLayer) {
			this.eachLayer(this._addFocusListenersOnLayer, this);
		}
	},

	_addFocusListenersOnLayer: function (layer) {
		var el = typeof layer.getElement === 'function' && layer.getElement();
		if (el) {
			DomEvent.on(el, 'focus', function () {
				this._tooltip._source = layer;
				this.openTooltip();
			}, this);
			DomEvent.on(el, 'blur', this.closeTooltip, this);
		}
	},

	_setAriaDescribedByOnLayer: function (layer) {
		var el = typeof layer.getElement === 'function' && layer.getElement();
		if (el) {
			el.setAttribute('aria-describedby', this._tooltip._container.id);
		}
	},


	_openTooltip: function (e) {
		if (!this._tooltip || !this._map) {
			return;
		}

		// 如果地图正在移动，我们将在它停止后显示工具提示。
		if (this._map.dragging && this._map.dragging.moving() && !this._openOnceFlag) {
			this._openOnceFlag = true;
			var that = this;
			this._map.once('moveend', function () {
				that._openOnceFlag = false;
				that._openTooltip(e);
			});
			return;
		}

		this._tooltip._source = e.layer || e.target;

		this.openTooltip(this._tooltip.options.sticky ? e.latlng : undefined);
	},

	_moveTooltip: function (e) {
		var latlng = e.latlng, containerPoint, layerPoint;
		if (this._tooltip.options.sticky && e.originalEvent) {
			containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
			layerPoint = this._map.containerPointToLayerPoint(containerPoint);
			latlng = this._map.layerPointToLatLng(layerPoint);
		}
		this._tooltip.setLatLng(latlng);
	}
});
