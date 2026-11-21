import {DivOverlay} from './DivOverlay';
import * as DomEvent from '../dom/DomEvent';
import * as DomUtil from '../dom/DomUtil';
import {Point, toPoint} from '../geometry/Point';
import {Map} from '../map/Map';
import {Layer} from './Layer';
import {Path} from './vector/Path';
import {FeatureGroup} from './FeatureGroup';

/*
 * @class Popup
 * @inherits DivOverlay
 * @aka L.Popup
 * 用于在地图的特定位置打开弹出窗口。使用 [地图.openPopup](#地图-openpopup) 来打开弹出窗口
 * 确保一次只打开一个弹出窗口，以同时打开多个弹出窗口
 * （推荐用于提升可用性），或使用 [地图.addLayer](#地图-addlayer) 来打开任意数量的弹出窗口
 *
 * @example
 *
 * If you want to just bind a popup to marker click and then open it, it's really easy:
 *
 * ```js
 * marker.bindPopup(popupContent).openPopup();
 * ```
 * Path overlays like polylines also have a `bindPopup` method.
 *
 * A popup can be also standalone:
 *
 * ```js
 * var popup = L.popup()
 * 	.setLatLng(latlng)
 * 	.setContent('<p>Hello world!<br />This is a nice popup.</p>')
 * 	.openOn(map);
 * ```
 * or
 * ```js
 * var popup = L.popup(latlng, {content: '<p>Hello world!<br />This is a nice popup.</p>')
 * 	.openOn(map);
 * ```
 */


// @namespace Popup
export var Popup = DivOverlay.extend({

	// @section
	// @aka Popup options
	options: {
		// @option pane: String = 'popupPane'
		// 将弹出窗口添加的“地图窗格”
		pane: 'popupPane',

		// @option offset: Point = Point(0, 7)
		// 弹出窗口的位置偏移量
		offset: [0, 7],

		// @option maxWidth: Number = 300
		// 弹出的弹出窗口的最大宽度，以像素为单位
		maxWidth: 300,

		// @option minWidth: Number = 50
		// 弹出的弹出窗口的最小宽度，以像素为单位
		minWidth: 50,

		// @option maxHeight: Number = null
		// 如果设置，则创建一个可滚动的容器，高度为给定值
		// 如果内容超过此尺寸，则会在弹出窗口内部进行滚动
		// 可滚动容器可以使用
		// `leaflet-popup-scrolled` CSS 类选择器进行样式设置
		maxHeight: null,

		// @option autoPan: Boolean = true
		// 如果不想地图执行平移动画以适配打开的弹出窗口，将其设置为 `false`
		// 以适配已打开的弹出窗口
		autoPan: true,

		// @option autoPanPaddingTopLeft: Point = null
		// 弹出的弹出窗口与地图左上角之间的边距
		// 自动平移操作后的视图中的边距
		autoPanPaddingTopLeft: null,

		// @option autoPanPaddingBottomRight: Point = null
		// 弹出的弹出窗口与地图右下角之间的边距
		// 自动平移操作后的视图中的边距
		autoPanPaddingBottomRight: null,

		// @option autoPanPadding: Point = Point(5, 5)
		// 相当于将左上角和右下角的自动平移填充值设置为相同的值
		autoPanPadding: [5, 5],

		// @option keepInView: Boolean = false
		// 如果希望防止用户在弹出窗口打开时将其平移出屏幕，将其设置为 `true`
		// 当弹出窗口打开时
		keepInView: false,

		// @option closeButton: Boolean = true
		// 控制弹出的弹出窗口中是否包含关闭按钮
		closeButton: true,

		// @option autoClose: Boolean = true
		// 如果希望覆盖另一个弹出窗口打开时默认关闭弹出窗口的行为，将其设置为 `false`
		// 当另一个弹出窗口被打开时
		autoClose: true,

		// @option closeOnEscapeKey: Boolean = true
		// 如果希望覆盖按 ESC 键关闭弹出窗口的默认行为，将其设置为 `false`
		// 如果希望覆盖用户点击地图时弹出窗口关闭的默认行为，可设置此值 默认值为地图的 [`closePopupOnClick`](#地图-closepopuponclick) 选项
		closeOnEscapeKey: true,

		// @option closeOnClick: Boolean = *
		// Set it if you want to override the default behavior of the 弹出窗口 closing when user clicks
		// on the 地图. Defaults to the 地图's [`closePopupOnClick`](#地图-closepopuponclick) option.

		// @option className: String = ''
		// 分配给弹出的弹出窗口的自定义 CSS 类名
		className: ''
	},

	// @namespace Popup
	// @method openOn(map: Map): this
	// `map.openPopup(popup)` 的替代方式
	// 将弹出窗口添加到地图上，并关闭之前的弹出窗口
	openOn: function (map) {
		map = arguments.length ? map : this._source._map; // experimental, not the part of public api

		if (!map.hasLayer(this) && map._popup && map._popup.options.autoClose) {
			map.removeLayer(map._popup);
		}
		map._popup = this;

		return DivOverlay.prototype.openOn.call(this, map);
	},

	onAdd: function (map) {
		DivOverlay.prototype.onAdd.call(this, map);

		// @namespace Map
		// @section Popup events
		// @event popupopen: PopupEvent
		// 在地图中打开弹出窗口时触发
		map.fire('popupopen', {popup: this});

		if (this._source) {
			// @namespace Layer
			// @section Popup events
			// @event popupopen: PopupEvent
			// 绑定到此图层的弹出窗口被打开时触发
			this._source.fire('popupopen', {popup: this}, true);
			// 对于非路径图层，通过再次点击该图层来切换弹出窗口状态，从而防止地图重新打开它
			// again the 图层, so prevent the 地图 to reopen it.
			if (!(this._source instanceof Path)) {
				this._source.on('preclick', DomEvent.stopPropagation);
			}
		}
	},

	onRemove: function (map) {
		DivOverlay.prototype.onRemove.call(this, map);

		// @namespace Map
		// @section Popup events
		// @event popupclose: PopupEvent
		// 在地图中的弹出窗口被关闭时触发
		map.fire('popupclose', {popup: this});

		if (this._source) {
			// @namespace Layer
			// @section Popup events
			// @event popupclose: PopupEvent
			// 当绑定到此层的弹出窗口关闭时触发。
			this._source.fire('popupclose', {popup: this}, true);
			if (!(this._source instanceof Path)) {
				this._source.off('preclick', DomEvent.stopPropagation);
			}
		}
	},

	getEvents: function () {
		var events = DivOverlay.prototype.getEvents.call(this);

		if (this.options.closeOnClick !== undefined ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
			events.preclick = this.close;
		}

		if (this.options.keepInView) {
			events.moveend = this._adjustPan;
		}

		return events;
	},

	_initLayout: function () {
		var prefix = 'leaflet-popup',
		    container = this._container = DomUtil.create('div',
			prefix + ' ' + (this.options.className || '') +
			' leaflet-zoom-animated');

		var wrapper = this._wrapper = DomUtil.create('div', prefix + '-content-wrapper', container);
		this._contentNode = DomUtil.create('div', prefix + '-content', wrapper);

		DomEvent.disableClickPropagation(container);
		DomEvent.disableScrollPropagation(this._contentNode);
		DomEvent.on(container, 'contextmenu', DomEvent.stopPropagation);

		this._tipContainer = DomUtil.create('div', prefix + '-tip-container', container);
		this._tip = DomUtil.create('div', prefix + '-tip', this._tipContainer);

		if (this.options.closeButton) {
			var closeButton = this._closeButton = DomUtil.create('a', prefix + '-close-button', container);
			closeButton.setAttribute('role', 'button'); // overrides the implicit role=link of <a> elements #7399
			closeButton.setAttribute('aria-label', 'Close popup');
			closeButton.href = '#close';
			closeButton.innerHTML = '<span aria-hidden="true">&#215;</span>';

			DomEvent.on(closeButton, 'click', function (ev) {
				DomEvent.preventDefault(ev);
				this.close();
			}, this);
		}
	},

	_updateLayout: function () {
		var container = this._contentNode,
		    style = container.style;

		style.width = '';
		style.whiteSpace = 'nowrap';

		var width = container.offsetWidth;
		width = Math.min(width, this.options.maxWidth);
		width = Math.max(width, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';

		style.height = '';

		var height = container.offsetHeight,
		    maxHeight = this.options.maxHeight,
		    scrolledClass = 'leaflet-popup-scrolled';

		if (maxHeight && height > maxHeight) {
			style.height = maxHeight + 'px';
			DomUtil.addClass(container, scrolledClass);
		} else {
			DomUtil.removeClass(container, scrolledClass);
		}

		this._containerWidth = this._container.offsetWidth;
	},

	_animateZoom: function (e) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center),
		    anchor = this._getAnchor();
		DomUtil.setPosition(this._container, pos.add(anchor));
	},

	_adjustPan: function () {
		if (!this.options.autoPan) { return; }
		if (this._map._panAnim) { this._map._panAnim.stop(); }

		// 如果设置了 keepInView 且视图重置，我们可以无限递归。
		// 如果我们正在响应自己的自动缩放操作，可以通过提前退出来防止这种情况发生。
		if (this._autopanning) {
			this._autopanning = false;
			return;
		}

		var map = this._map,
		    marginBottom = parseInt(DomUtil.getStyle(this._container, 'marginBottom'), 10) || 0,
		    containerHeight = this._container.offsetHeight + marginBottom,
		    containerWidth = this._containerWidth,
		    layerPos = new Point(this._containerLeft, -containerHeight - this._containerBottom);

		layerPos._add(DomUtil.getPosition(this._container));

		var containerPos = map.layerPointToContainerPoint(layerPos),
		    padding = toPoint(this.options.autoPanPadding),
		    paddingTL = toPoint(this.options.autoPanPaddingTopLeft || padding),
		    paddingBR = toPoint(this.options.autoPanPaddingBottomRight || padding),
		    size = map.getSize(),
		    dx = 0,
		    dy = 0;

		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
		}
		if (containerPos.x - dx - paddingTL.x < 0) { // left
			dx = containerPos.x - paddingTL.x;
		}
		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
		}
		if (containerPos.y - dy - paddingTL.y < 0) { // top
			dy = containerPos.y - paddingTL.y;
		}

		// @namespace Map
		// @section Popup events
		// @event autopanstart: Event
		// 当打开弹出窗口时地图开始自动缩放时触发。
		if (dx || dy) {
			// 跟踪是否处于自动缩放状态，因为此函数会在 moveend 时重新执行。
			if (this.options.keepInView) {
				this._autopanning = true;
			}

			map
			    .fire('autopanstart')
			    .panBy([dx, dy]);
		}
	},

	_getAnchor: function () {
		// 我们在源层上应该将弹出窗口锚定在哪里？
		return toPoint(this._source && this._source._getPopupAnchor ? this._source._getPopupAnchor() : [0, 0]);
	}

});

// @namespace Popup
// @factory L.popup(options?: Popup options, source?: Layer)
// 根据可选的 `options` 对象创建 `Popup` 对象，`options` 描述了其外观和位置，同时根据可选的 `source` 对象使用该层引用来标记弹出窗口。
// @alternative
// @factory L.popup(latlng: LatLng, options?: Popup options)
// 根据 `latlng` 创建 `Popup` 对象，弹出窗口将在该位置打开，同时根据可选的 `options` 对象描述其外观和位置。
export var popup = function (options, source) {
	return new Popup(options, source);
};


/* @namespace Map
 * @section Interaction Options
 * @option closePopupOnClick: Boolean = true
 * 如果不想在用户点击地图时关闭弹出窗口，将其设置为 `false`。
 */
Map.mergeOptions({
	closePopupOnClick: true
});


// @namespace Map
// @section Methods for Layers and Controls
Map.include({
	// @method openPopup(popup: Popup): this
	// 打开指定的弹出窗口，同时关闭之前打开的（以确保每次只打开一个，提高可用性）。
	// @alternative
	// @method openPopup(content: String|HTMLElement, latlng: LatLng, options?: Popup options): this
	// 创建具有指定内容和选项的弹出窗口，并在地图上的给定点打开它。
	openPopup: function (popup, latlng, options) {
		this._initOverlay(Popup, popup, latlng, options)
		  .openOn(this);

		return this;
	},

	// @method closePopup(popup?: Popup): this
	// 使用 [openPopup](#地图-open-弹出窗口) 或给定的方式关闭之前打开的弹出窗口。
	closePopup: function (popup) {
		popup = arguments.length ? popup : this._popup;
		if (popup) {
			popup.close();
		}
		return this;
	}
});

/*
 * @namespace Layer
 * @section Popup methods example
 *
 * 所有图层都共享一组便于将弹出窗口绑定到它的方法。
 *
 * ```js
 * var layer = L.Polygon(latlngs).bindPopup('Hi There!').addTo(map);
 * 图层.openPopup();
 * 图层.closePopup();
 * ```
 *
 * 当点击图层时也会自动打开弹出窗口，当从地图中移除图层或打开其他弹出窗口时则关闭。
 */

// @section Popup methods
Layer.include({

	// @method bindPopup(content: String|HTMLElement|Function|Popup, options?: Popup options): this
	// 使用传递的 `content` 将弹出窗口绑定到图层，并设置必要的事件监听器。如果传递了 `Function`，它将接收
	// 作为第一个参数的图层，并且应返回 `String` 或 `HTMLElement`。
	// 使用 `bindPopup` 移除之前绑定的弹出窗口。
	bindPopup: function (content, options) {
		this._popup = this._initOverlay(Popup, this._popup, content, options);
		if (!this._popupHandlersAdded) {
			this.on({
				click: this._openPopup,
				keypress: this._onKeyPress,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = true;
		}

		return this;
	},

	// @method unbindPopup(): this
	// Removes the 弹出窗口 previously bound with `bindPopup`.
	unbindPopup: function () {
		if (this._popup) {
			this.off({
				click: this._openPopup,
				keypress: this._onKeyPress,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = false;
			this._popup = null;
		}
		return this;
	},

	// @method openPopup(latlng?: LatLng): this
	// 在指定的 `latlng` 位置打开绑定后的弹出窗口，如果未传递 `latlng`，则使用默认锚点。
	openPopup: function (latlng) {
		if (this._popup) {
			if (!(this instanceof FeatureGroup)) {
				this._popup._source = this;
			}
			if (this._popup._prepareOpen(latlng || this._latlng)) {
				// 在地图上打开弹出窗口。
				this._popup.openOn(this._map);
			}
		}
		return this;
	},

	// @method closePopup(): this
	// 如果此层上的弹出窗口处于打开状态，则关闭它。
	closePopup: function () {
		if (this._popup) {
			this._popup.close();
		}
		return this;
	},

	// @method togglePopup(): this
	// 根据当前状态打开或关闭绑定到此层的弹出窗口。
	togglePopup: function () {
		if (this._popup) {
			this._popup.toggle(this);
		}
		return this;
	},

	// @method isPopupOpen(): boolean
	// 如果绑定到此层的弹出窗口当前处于打开状态，则返回 `true`。
	isPopupOpen: function () {
		return (this._popup ? this._popup.isOpen() : false);
	},

	// @method setPopupContent(content: String|HTMLElement|Popup): this
	// 设置绑定到此层的弹出窗口内容。
	setPopupContent: function (content) {
		if (this._popup) {
			this._popup.setContent(content);
		}
		return this;
	},

	// @method getPopup(): Popup
	// 返回绑定到此层的弹出窗口。
	getPopup: function () {
		return this._popup;
	},

	_openPopup: function (e) {
		if (!this._popup || !this._map) {
			return;
		}
		// 阻止地图点击
		DomEvent.stop(e);

		var target = e.layer || e.target;
		if (this._popup._source === target && !(target instanceof Path)) {
			// 将其视为标记并处理
			// 判断是否应切换其开启/关闭状态
			if (this._map.hasLayer(this._popup)) {
				this.closePopup();
			} else {
				this.openPopup(e.latlng);
			}
			return;
		}
		this._popup._source = target;
		this.openPopup(e.latlng);
	},

	_movePopup: function (e) {
		this._popup.setLatLng(e.latlng);
	},

	_onKeyPress: function (e) {
		if (e.originalEvent.keyCode === 13) {
			this._openPopup(e);
		}
	}
});
