import {Layer} from './Layer';
import * as Util from '../core/Util';
import {toLatLngBounds} from '../geo/LatLngBounds';
import {Bounds} from '../geometry/Bounds';
import * as DomUtil from '../dom/DomUtil';

/*
 * @class ImageOverlay
 * @aka L.ImageOverlay
 * @inherits Interactive layer
 *
 * 用于在地图特定范围内加载和显示单个图像。继承自 `Layer` 类。
 *
 * @example
 *
 * ```js
 * var imageUrl = 'https://maps.lib.utexas.edu/maps/historical/newark_nj_1922.jpg',
 * 	imageBounds = [[40.712216, -74.22655], [40.773941, -74.12544]];
 * L.imageOverlay(imageUrl, imageBounds).addTo(map);
 * ```
 */

export var ImageOverlay = Layer.extend({

	// @section
	// @aka ImageOverlay options
	options: {
		// @option opacity: Number = 1.0
		// 图像覆盖层的透明度。
		opacity: 1,

		// @option alt: String = ''
		// 图像的 `alt` 属性文本（对可访问性有帮助）。
		alt: '',

		// @option interactive: Boolean = false
		// 如果设置为 `true`，图像覆盖层在被点击或悬停时会触发 [鼠标事件](#interactive-图层)。
		interactive: false,

		// @option crossOrigin: Boolean|String = false
		// 是否将 `crossOrigin` 属性添加到图像中。
		// 如果提供字符串，图像将把 `crossOrigin` 属性设置为该字符串。如果需要访问图像像素数据，则需要此设置。
		// 有效字符串值请参考 [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes)。
		crossOrigin: false,

		// @option errorOverlayUrl: String = ''
		// 用于显示在加载失败的覆盖层中的替代图像URL。
		errorOverlayUrl: '',

		// @option zIndex: Number = 1
		// 覆盖层层的显式 [zIndex](#imageoverlay-zindex) 值。
		zIndex: 1,

		// @option className: String = ''
		// 分配给图像的自定义类名。默认值为空。
		className: ''
	},

	initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._bounds = toLatLngBounds(bounds);

		Util.setOptions(this, options);
	},

	onAdd: function () {
		if (!this._image) {
			this._initImage();

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}

		if (this.options.interactive) {
			DomUtil.addClass(this._image, 'leaflet-interactive');
			this.addInteractiveTarget(this._image);
		}

		this.getPane().appendChild(this._image);
		this._reset();
	},

	onRemove: function () {
		DomUtil.remove(this._image);
		if (this.options.interactive) {
			this.removeInteractiveTarget(this._image);
		}
	},

	// @method setOpacity(opacity: Number): this
	// 设置覆盖层的透明度。
	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._image) {
			this._updateOpacity();
		}
		return this;
	},

	setStyle: function (styleOpts) {
		if (styleOpts.opacity) {
			this.setOpacity(styleOpts.opacity);
		}
		return this;
	},

	// @method bringToFront(): this
	// 将图层置于所有覆盖层的最顶部。
	bringToFront: function () {
		if (this._map) {
			DomUtil.toFront(this._image);
		}
		return this;
	},

	// @method bringToBack(): this
	// 将图层置于所有覆盖层的最底部。
	bringToBack: function () {
		if (this._map) {
			DomUtil.toBack(this._image);
		}
		return this;
	},

	// @method setUrl(url: String): this
	// 更改图像的URL。
	setUrl: function (url) {
		this._url = url;

		if (this._image) {
			this._image.src = url;
		}
		return this;
	},

	// @method setBounds(bounds: LatLngBounds): this
	// 更新此 ImageOverlay 所覆盖的边界范围。
	setBounds: function (bounds) {
		this._bounds = toLatLngBounds(bounds);

		if (this._map) {
			this._reset();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			zoom: this._reset,
			viewreset: this._reset
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	// @method setZIndex(value: Number): this
	// 更改图像覆盖层的 [zIndex](#imageoverlay-zindex)。
	setZIndex: function (value) {
		this.options.zIndex = value;
		this._updateZIndex();
		return this;
	},

	// @method getBounds(): LatLngBounds
	// 获取此 ImageOverlay 所覆盖的边界范围。
	getBounds: function () {
		return this._bounds;
	},

	// @method getElement(): HTMLElement
	// 返回 [`HTMLImageElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement) 的实例。
	// 此覆盖层使用该实例。
	getElement: function () {
		return this._image;
	},

	_initImage: function () {
		var wasElementSupplied = this._url.tagName === 'IMG';
		var img = this._image = wasElementSupplied ? this._url : DomUtil.create('img');

		DomUtil.addClass(img, 'leaflet-image-layer');
		if (this._zoomAnimated) { DomUtil.addClass(img, 'leaflet-zoom-animated'); }
		if (this.options.className) { DomUtil.addClass(img, this.options.className); }

		img.onselectstart = Util.falseFn;
		img.onmousemove = Util.falseFn;

		// @event load: Event
		// 当 ImageOverlay 图层加载其图像时触发。
		img.onload = Util.bind(this.fire, this, 'load');
		img.onerror = Util.bind(this._overlayOnError, this, 'error');

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		}

		if (this.options.zIndex) {
			this._updateZIndex();
		}

		if (wasElementSupplied) {
			this._url = img.src;
			return;
		}

		img.src = this._url;
		img.alt = this.options.alt;
	},

	_animateZoom: function (e) {
		var scale = this._map.getZoomScale(e.zoom),
		    offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;

		DomUtil.setTransform(this._image, offset, scale);
	},

	_reset: function () {
		var image = this._image,
		    bounds = new Bounds(
		        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		        this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
		    size = bounds.getSize();

		DomUtil.setPosition(image, bounds.min);

		image.style.width  = size.x + 'px';
		image.style.height = size.y + 'px';
	},

	_updateOpacity: function () {
		DomUtil.setOpacity(this._image, this.options.opacity);
	},

	_updateZIndex: function () {
		if (this._image && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._image.style.zIndex = this.options.zIndex;
		}
	},

	_overlayOnError: function () {
		// @event error: Event
		// 当 ImageOverlay 图层无法加载其图像时触发。
		this.fire('error');

		var errorUrl = this.options.errorOverlayUrl;
		if (errorUrl && this._url !== errorUrl) {
			this._url = errorUrl;
			this._image.src = errorUrl;
		}
	},

	// @method getCenter(): LatLng
	// 返回 ImageOverlay 的中心点。
	getCenter: function () {
		return this._bounds.getCenter();
	}
});

// @factory L.imageOverlay(imageUrl: String, bounds: LatLngBounds, options?: ImageOverlay options)
// 根据图像的URL及其关联的地理边界范围，实例化一个图像覆盖层对象。
// geographical 边界 it is tied to.
export var imageOverlay = function (url, bounds, options) {
	return new ImageOverlay(url, bounds, options);
};
