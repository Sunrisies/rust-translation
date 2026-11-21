import * as Util from '../core/Util';
import {Evented} from '../core/Events';
import {EPSG3857} from '../geo/crs/CRS.EPSG3857';
import {Point, toPoint} from '../geometry/Point';
import {Bounds, toBounds} from '../geometry/Bounds';
import {LatLng, toLatLng} from '../geo/LatLng';
import {LatLngBounds, toLatLngBounds} from '../geo/LatLngBounds';
import Browser from '../core/Browser';
import * as DomEvent from '../dom/DomEvent';
import * as DomUtil from '../dom/DomUtil';
import {PosAnimation} from '../dom/PosAnimation';

/*
 * @class Map
 * @aka L.Map
 * @inherits Evented
 *
 * 该 API 的核心类，用于在页面上创建地图并操作它。
 *
 * @example
 *
 * ```js
 * // initialize the map on the "map" div with a given center and zoom
 * var map = L.map('map', {
 * 	center: [51.505, -0.09],
 * 	zoom: 13
 * });
 * ```
 *
 */

export var Map = Evented.extend({

	options: {
		// @section Map State Options
		// @option crs: CRS = L.CRS.EPSG3857
		// 要使用的[坐标参考系统](#crs)。如果不确定其含义，请勿更改此值。
		// 你确定其含义吗？
		crs: EPSG3857,

		// @option center: LatLng = undefined
		// 地图的初始地理中心点
		center: undefined,

		// @option zoom: Number = undefined
		// 地图的初始缩放级别
		zoom: undefined,

		// @option minZoom: Number = *
		// 地图的最低缩放级别
		// 如果未指定且地图中至少包含一个 `GridLayer` 或 `TileLayer`，
		// 则使用它们 `minZoom` 选项中的最低值。
		minZoom: undefined,

		// @option maxZoom: Number = *
		// 地图的最大缩放级别
		// 如果未指定且地图中至少包含一个 `GridLayer` 或 `TileLayer`，
		// 则使用它们 `maxZoom` 选项中的最高值。
		maxZoom: undefined,

		// @option layers: Layer[] = []
		// 最初将添加到地图的图层数组
		layers: [],

		// @option maxBounds: LatLngBounds = null
		// 设置此选项后，地图会将视图限制在给定的地理范围内，
		// 如果用户尝试在视图外平移，系统会将其返回。要动态设置限制，请使用
		// outside the view. To set the restriction dynamically, use
		// [`setMaxBounds`](#map-setmaxbounds) method.
		maxBounds: undefined,

		// @option renderer: Renderer = *
		// 在地图上绘制矢量图层的默认方法。`L.SVG`
		// 或根据浏览器支持情况默认为 `L.Canvas`。
		renderer: undefined,


		// @section Animation Options
		// @option zoomAnimation: Boolean = true
		// 是否启用地图缩放动画。默认情况下，除了 Android 外，
		// 所有支持 CSS3 Transitions 的浏览器都启用此功能。
		zoomAnimation: true,

		// @option zoomAnimationThreshold: Number = 4
		// 如果缩放差异超过该值，则不会播放缩放动画。
		zoomAnimationThreshold: 4,

		// @option fadeAnimation: Boolean = true
		// 是否启用瓦片淡出动画。默认情况下，除了 Android 外，
		// 所有支持 CSS3 Transitions 的浏览器都启用此功能。
		fadeAnimation: true,

		// @option markerZoomAnimation: Boolean = true
		// 如果禁用，标记是否会随缩放动画一起变化？如果禁用，
		// 它们将在动画期间消失。默认情况下，除了 Android 外，
		// 所有支持 CSS3 Transitions 的浏览器都启用此功能。
		markerZoomAnimation: true,

		// @option transform3DLimit: Number = 2^23
		// 定义 CSS 变换的最大尺寸。默认值不应更改，除非在进行大范围 `panBy` 后，
		// 网页浏览器将图层定位到错误位置。
		// 强制地图的缩放级别始终为该值的倍数，特别是在执行 [`fitBounds()`](#地图-fitbounds) 或捏合缩放后。
		transform3DLimit: 8388608, // Precision limit of a 32-bit float

		// @section Interaction Options
		// @option zoomSnap: Number = 1
		// 默认情况下，缩放级别会四舍五入到最接近的整数；较低的值
		// （例如 `0.5` 或 `0.1`）允许更精细的精度。值为 `0` 时则禁用此功能。
		// By default, the zoom level snaps to the nearest integer; lower values
		// (e.g. `0.5` or `0.1`) allow for greater granularity. A value of `0`
		// 表示在 `fitBounds` 或捏合缩放后不会自动调整缩放级别。
		zoomSnap: 1,

		// @option zoomDelta: Number = 1
		// 控制地图在按下
		// [`zoomIn()`](#map-zoomin), [`zoomOut()`](#map-zoomout), pressing `+`
		// 键或 `-` 键，或使用 [缩放控件](#控件-zoom) 后缩放级别的变化幅度。
		// 小于 `1` 的值（例如 `0.5`）允许更细的精度。
		zoomDelta: 1,

		// @option trackResize: Boolean = true
		// 确定浏览器窗口大小变化时地图是否自动更新自身视图。
		trackResize: true
	},

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = Util.setOptions(this, options);

		// 务必在开头分配内部标志，
		// 以避免某些边缘情况下出现状态不一致的问题。
		this._handlers = [];
		this._layers = {};
		this._zoomBoundLayers = {};
		this._sizeChanged = true;

		this._initContainer(id);
		this._initLayout();

		// https://github.com/Leaflet/Leaflet/issues/1980 中的技巧
		this._onResize = Util.bind(this._onResize, this);

		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.zoom !== undefined) {
			this._zoom = this._limitZoom(options.zoom);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(toLatLng(options.center), options.zoom, {reset: true});
		}

		this.callInitHooks();

		// 在没有硬件加速过渡的浏览器或旧版 Android/Opera 上不要进行动画效果。
		this._zoomAnimated = DomUtil.TRANSITION && Browser.any3d && !Browser.mobileOpera &&
				this.options.zoomAnimation;

		// 所有图层的缩放过渡持续时间相同，因此如果 `transitionend` 事件发生在缩放动画开始之后（传播到地图区域），说明全局缩放已结束。
		// 给定
		if (this._zoomAnimated) {
			this._createAnimProxy();
			DomEvent.on(this._proxy, DomUtil.TRANSITION_END, this._catchTransitionEnd, this);
		}

		this._addLayers(this.options.layers);
	},


	// @section Methods for modifying map state

	// @method setView(center: LatLng, zoom: Number, options?: Zoom/pan options): this
	// Sets the view of the 地图 (geographical center and zoom) with the given
	// 动画选项来设置地图视图（地理中心和缩放级别）。
	setView: function (center, zoom, options) {

		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(toLatLng(center), zoom, this.options.maxBounds);
		options = options || {};

		this._stop();

		if (this._loaded && !options.reset && options !== true) {

			if (options.animate !== undefined) {
				options.zoom = Util.extend({animate: options.animate}, options.zoom);
				options.pan = Util.extend({animate: options.animate, duration: options.duration}, options.pan);
			}

			// 尝试对平移或缩放进行动画处理。
			var moved = (this._zoom !== zoom) ?
				this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (moved) {
				// 防止调用大小调整处理器，无论如何动画结束后视图都会刷新。
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// 动画没有开始，只是重置了地图视图。
		this._resetView(center, zoom, options.pan && options.pan.noMoveStart);

		return this;
	},

	// @method setZoom(zoom: Number, options?: Zoom/pan options): this
	// 设置地图的缩放级别。
	setZoom: function (zoom, options) {
		if (!this._loaded) {
			this._zoom = zoom;
			return this;
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	},

	// @method zoomIn(delta?: Number, options?: Zoom options): this
	// 默认将地图的缩放级别增加 `delta` ([`zoomDelta`](#地图-zoomdelta)])。
	zoomIn: function (delta, options) {
		delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
		return this.setZoom(this._zoom + delta, options);
	},

	// @method zoomOut(delta?: Number, options?: Zoom options): this
	// 默认将地图的缩放级别减少 `delta` ([`zoomDelta`](#地图-zoomdelta)])。
	zoomOut: function (delta, options) {
		delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
		return this.setZoom(this._zoom - delta, options);
	},

	// @method setZoomAround(latlng: LatLng, zoom: Number, options: Zoom options): this
	// 在保持地图上指定地理点不变的情况下进行缩放。
	// 固定位置（例如用于内部滚动缩放和双击缩放）。
	// @alternative
	// @method setZoomAround(offset: Point, zoom: Number, options: Zoom options): this
	// 在保持地图上相对于左上角的指定像素点不动的情况下进行缩放。
	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof Point ? latlng : this.latLngToContainerPoint(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	_getBoundsCenterZoom: function (bounds, options) {

		options = options || {};
		bounds = bounds.getBounds ? bounds.getBounds() : toLatLngBounds(bounds);

		var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]),

		    zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

		zoom = (typeof options.maxZoom === 'number') ? Math.min(options.maxZoom, zoom) : zoom;

		if (zoom === Infinity) {
			return {
				center: bounds.getCenter(),
				zoom: zoom
			};
		}

		var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		return {
			center: center,
			zoom: zoom
		};
	},

	// @method fitBounds(bounds: LatLngBounds, options?: fitBounds options): this
	// 设置包含给定地理边界的地图视图，使用最大可能的
	// 缩放级别。
	fitBounds: function (bounds, options) {

		bounds = toLatLngBounds(bounds);

		if (!bounds.isValid()) {
			throw new Error('Bounds are not valid.');
		}

		var target = this._getBoundsCenterZoom(bounds, options);
		return this.setView(target.center, target.zoom, options);
	},

	// @method fitWorld(options?: fitBounds options): this
	// 设置大部分包含整个世界且使用最大可能
	// 缩放级别的地图视图。
	fitWorld: function (options) {
		return this.fitBounds([[-90, -180], [90, 180]], options);
	},

	// @method panTo(latlng: LatLng, options?: Pan options): this
	// 将地图平移到指定中心位置。
	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	// @method panBy(offset: Point, options?: Pan options): this
	// 通过给定的像素数量（动画效果）将地图平移。
	panBy: function (offset, options) {
		offset = toPoint(offset).round();
		options = options || {};

		if (!offset.x && !offset.y) {
			return this.fire('moveend');
		}
		// 如果平移距离过大，Chrome 的瓦片会出现问题，
		// 导致瓦片消失或出现在错误位置（略有偏移） #2602
		if (options.animate !== true && !this.getSize().contains(offset)) {
			this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
			return this;
		}

		if (!this._panAnim) {
			this._panAnim = new PosAnimation();

			this._panAnim.on({
				'step': this._onPanTransitionStep,
				'end': this._onPanTransitionEnd
			}, this);
		}

		// 在动画惯性过程中不要触发 `movestart` 事件。
		if (!options.noMoveStart) {
			this.fire('movestart');
		}

		// 除非指定了 `animate: false`，否则执行地图平移动画。
		if (options.animate !== false) {
			DomUtil.addClass(this._mapPane, 'leaflet-pan-anim');

			var newPos = this._getMapPanePos().subtract(offset).round();
			this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
	},

	// @method flyTo(latlng: LatLng, zoom?: Number, options?: Zoom/pan options): this
	// 设置地图视图（地理中心与缩放），以平滑的
	// 平移-缩放动画方式呈现。
	flyTo: function (targetCenter, targetZoom, options) {

		options = options || {};
		if (options.animate === false || !Browser.any3d) {
			return this.setView(targetCenter, targetZoom, options);
		}

		this._stop();

		var from = this.project(this.getCenter()),
		    to = this.project(targetCenter),
		    size = this.getSize(),
		    startZoom = this._zoom;

		targetCenter = toLatLng(targetCenter);
		targetZoom = targetZoom === undefined ? startZoom : targetZoom;

		var w0 = Math.max(size.x, size.y),
		    w1 = w0 * this.getZoomScale(startZoom, targetZoom),
		    u1 = (to.distanceTo(from)) || 1,
		    rho = 1.42,
		    rho2 = rho * rho;

		function r(i) {
			var s1 = i ? -1 : 1,
			    s2 = i ? w1 : w0,
			    t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1,
			    b1 = 2 * s2 * rho2 * u1,
			    b = t1 / b1,
			    sq = Math.sqrt(b * b + 1) - b;

			    // 解决浮点精度错误问题，当 `sq = 0` 且 `log = -Infinite` 时，
			    // 从而在 `flyTo` 中引发无限循环。
			    var log = sq < 0.000000001 ? -18 : Math.log(sq);

			return log;
		}

		function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
		function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
		function tanh(n) { return sinh(n) / cosh(n); }

		var r0 = r(0);

		function w(s) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
		function u(s) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

		function easeOut(t) { return 1 - Math.pow(1 - t, 1.5); }

		var start = Date.now(),
		    S = (r(1) - r0) / rho,
		    duration = options.duration ? 1000 * options.duration : 1000 * S * 0.8;

		function frame() {
			var t = (Date.now() - start) / duration,
			    s = easeOut(t) * S;

			if (t <= 1) {
				this._flyToFrame = Util.requestAnimFrame(frame, this);

				this._move(
					this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
					this.getScaleZoom(w0 / w(s), startZoom),
					{flyTo: true});

			} else {
				this
					._move(targetCenter, targetZoom)
					._moveEnd(true);
			}
		}

		this._moveStart(true, options.noMoveStart);

		frame.call(this);
		return this;
	},

	// @method flyToBounds(bounds: LatLngBounds, options?: fitBounds options): this
	// 以类似 [`flyTo`](#地图-flyto) 的平滑动画方式设置地图视图。
	// 但需要传入 `fitBounds` 参数来限制范围。
	flyToBounds: function (bounds, options) {
		var target = this._getBoundsCenterZoom(bounds, options);
		return this.flyTo(target.center, target.zoom, options);
	},

	// @method setMaxBounds(bounds: LatLngBounds): this
	// 将地图视图限制在给定的范围内（参见 [maxBounds](#地图-maxbounds) 选项）。
	setMaxBounds: function (bounds) {
		bounds = toLatLngBounds(bounds);

		if (this.listens('moveend', this._panInsideMaxBounds)) {
			this.off('moveend', this._panInsideMaxBounds);
		}

		if (!bounds.isValid()) {
			this.options.maxBounds = null;
			return this;
		}

		this.options.maxBounds = bounds;

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		return this.on('moveend', this._panInsideMaxBounds);
	},

	// @method setMinZoom(zoom: Number): this
	// 设定可用缩放级别的下限（参见 [minZoom](#地图-minzoom) 选项）。
	setMinZoom: function (zoom) {
		var oldZoom = this.options.minZoom;
		this.options.minZoom = zoom;

		if (this._loaded && oldZoom !== zoom) {
			this.fire('zoomlevelschange');

			if (this.getZoom() < this.options.minZoom) {
				return this.setZoom(zoom);
			}
		}

		return this;
	},

	// @method setMaxZoom(zoom: Number): this
	// 设定可用缩放级别的上限（参见 [maxZoom](#地图-maxzoom) 选项）。
	setMaxZoom: function (zoom) {
		var oldZoom = this.options.maxZoom;
		this.options.maxZoom = zoom;

		if (this._loaded && oldZoom !== zoom) {
			this.fire('zoomlevelschange');

			if (this.getZoom() > this.options.maxZoom) {
				return this.setZoom(zoom);
			}
		}

		return this;
	},

	// @method panInsideBounds(bounds: LatLngBounds, options?: Pan options): this
	// 将地图平移到位于给定范围内的最近视图位置（如果尚未处于该位置），并根据特定选项控制动画效果。
	panInsideBounds: function (bounds, options) {
		this._enforcingBounds = true;
		var center = this.getCenter(),
		    newCenter = this._limitCenter(center, this._zoom, toLatLngBounds(bounds));

		if (!center.equals(newCenter)) {
			this.panTo(newCenter, options);
		}

		this._enforcingBounds = false;
		return this;
	},

	// @method panInside(latlng: LatLng, options?: padding options): this
	// 以最小幅度平移地图，使 `latlng` 可见。使用
	// 填充选项来适配更有限的显示范围。
	// 如果 `latlng` 已位于（可能经过填充的）显示范围内，
	// 则不会进行平移操作。
	panInside: function (latlng, options) {
		options = options || {};

		var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]),
		    pixelCenter = this.project(this.getCenter()),
		    pixelPoint = this.project(latlng),
		    pixelBounds = this.getPixelBounds(),
		    paddedBounds = toBounds([pixelBounds.min.add(paddingTL), pixelBounds.max.subtract(paddingBR)]),
		    paddedSize = paddedBounds.getSize();

		if (!paddedBounds.contains(pixelPoint)) {
			this._enforcingBounds = true;
			var centerOffset = pixelPoint.subtract(paddedBounds.getCenter());
			var offset = paddedBounds.extend(pixelPoint).getSize().subtract(paddedSize);
			pixelCenter.x += centerOffset.x < 0 ? -offset.x : offset.x;
			pixelCenter.y += centerOffset.y < 0 ? -offset.y : offset.y;
			this.panTo(this.unproject(pixelCenter), options);
			this._enforcingBounds = false;
		}
		return this;
	},

	// @method invalidateSize(options: Zoom/pan options): this
	// 检查地图容器大小是否变化，若发生变化则更新地图——
	// 在动态改变地图大小时调用此函数，并默认执行平移动画。 如果 `options.pan` 为 `false`，则不进行平移。
	// pan by default. If `options.pan` is `false`, panning will not occur.
	// 如果 `options.debounceMoveend` 为 `true`，则会延迟 `moveend` 事件，
	// 即使该方法连续被多次调用，也不会频繁触发。
	// times in a row.

	// @alternative
	// @method invalidateSize(animate: Boolean): this
	// 检查地图容器大小是否变化，若发生变化则更新地图——
	// 在动态改变地图大小时调用此函数，并默认执行平移动画。
	// 默认执行平移操作。
	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = Util.extend({
			animate: false,
			pan: true
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;
		this._lastCenter = null;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(Util.bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		// @section Map state change events
		// @event resize: ResizeEvent
		// 当地图尺寸改变时触发。
		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	// @section Methods for modifying map state
	// @method stop(): this
	// 停止当前正在运行的 `panTo` 或 `flyTo` 动画（如果有的话）。
	stop: function () {
		this.setZoom(this._limitZoom(this._zoom));
		if (!this.options.zoomSnap) {
			this.fire('viewreset');
		}
		return this._stop();
	},

	// @section Geolocation methods
	// @method locate(options?: Locate options): this
	// 尝试使用 Geolocation API 定位用户，成功时触发 [`locationfound`](#地图-locationfound) 事件，
	// 失败时触发 [`locationerror`](#地图-locationerror) 事件，
	// 并可选地将地图视图设置为用户的位置。
	// 检测精度（如果定位失败，则显示世界视图）。
	// 请注意，如果您的页面未使用 HTTPS，此方法将失败。
	// 现代浏览器（[Chrome 50及更高版本](https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-powerful-features-on-insecure-origins)）
	// 更多详情请参见 `Locate options`。
	locate: function (options) {

		options = this._locateOptions = Util.extend({
			timeout: 10000,
			watch: false
			// setView: false
			// maxZoom: <数字>
			// maximumAge: 0
			// enableHighAccuracy: false
		}, options);

		if (!('geolocation' in navigator)) {
			this._handleGeolocationError({
				code: 0,
				message: 'Geolocation not supported.'
			});
			return this;
		}

		var onResponse = Util.bind(this._handleGeolocationResponse, this),
		    onError = Util.bind(this._handleGeolocationError, this);

		if (options.watch) {
			this._locationWatchId =
			        navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	},

	// @method stopLocate(): this
	// 停止监听由 `map.locate({watch: true})` 之前启动的位置信息。
	// 如果调用 `map.locate` 时传入
	// `{setView: true}`，则终止重置地图视图的操作。
	stopLocate: function () {
		if (navigator.geolocation && navigator.geolocation.clearWatch) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	},

	_handleGeolocationError: function (error) {
		if (!this._container._leaflet_id) { return; }

		var c = error.code,
		    message = error.message ||
		            (c === 1 ? 'permission denied' :
		            (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions.setView && !this._loaded) {
			this.fitWorld();
		}

		// @section Location events
		// @event locationerror: ErrorEvent
		// 在使用 [`locate`](#地图-locate) 方法进行定位失败时触发。
		this.fire('locationerror', {
			code: c,
			message: 'Geolocation error: ' + message + '.'
		});
	},

	_handleGeolocationResponse: function (pos) {
		if (!this._container._leaflet_id) { return; }

		var lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new LatLng(lat, lng),
		    bounds = latlng.toBounds(pos.coords.accuracy * 2),
		    options = this._locateOptions;

		if (options.setView) {
			var zoom = this.getBoundsZoom(bounds);
			this.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
		}

		var data = {
			latlng: latlng,
			bounds: bounds,
			timestamp: pos.timestamp
		};

		for (var i in pos.coords) {
			if (typeof pos.coords[i] === 'number') {
				data[i] = pos.coords[i];
			}
		}

		// @event locationfound: LocationEvent
		// 在使用 [`locate`](#地图-locate) 方法进行定位成功时触发。
		// 创建具有给定名称的新 [地图窗格](#地图-pane)，如果不存在则创建，然后返回该窗格。该窗格作为 `container` 的子节点，或者
		this.fire('locationfound', data);
	},

	// TODO Appropriate docs section?
	// @section Other Methods
	// @method addHandler(name: String, HandlerClass: Function): this
	// Adds a new `Handler` to the 地图, given its name and constructor function.
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		return this;
	},

	// @method remove(): this
	// Destroys the 地图 and clears all related event listeners.
	remove: function () {

		this._initEvents(true);
		if (this.options.maxBounds) { this.off('moveend', this._panInsideMaxBounds); }

		if (this._containerId !== this._container._leaflet_id) {
			throw new Error('Map container is being reused by another instance');
		}

		try {
			// throws error in IE6-8
			delete this._container._leaflet_id;
			delete this._containerId;
		} catch (e) {
			/*eslint-disable */
			this._container._leaflet_id = undefined;
			/* eslint-enable */
			this._containerId = undefined;
		}

		if (this._locationWatchId !== undefined) {
			this.stopLocate();
		}

		this._stop();

		DomUtil.remove(this._mapPane);

		if (this._clearControlPos) {
			this._clearControlPos();
		}
		if (this._resizeRequest) {
			Util.cancelAnimFrame(this._resizeRequest);
			this._resizeRequest = null;
		}

		this._clearHandlers();

		if (this._loaded) {
			// @section Map state change events
			// @event unload: Event
			// Fired when the 地图 is destroyed with [remove](#地图-remove) method.
			this.fire('unload');
		}

		var i;
		for (i in this._layers) {
			this._layers[i].remove();
		}
		for (i in this._panes) {
			DomUtil.remove(this._panes[i]);
		}

		this._layers = [];
		this._panes = [];
		delete this._mapPane;
		delete this._renderer;

		return this;
	},

	// @section Other Methods
	// @method createPane(name: String, container?: HTMLElement): HTMLElement
	// Creates a new [地图 pane](#地图-pane) with the given name if it doesn't exist already,
	// then returns it. The pane is created as a child of `container`, or
	// 如果不设置，则作为主地图窗格的子节点。
	createPane: function (name, container) {
		var className = 'leaflet-pane' + (name ? ' leaflet-' + name.replace('Pane', '') + '-pane' : ''),
		    pane = DomUtil.create('div', className, container || this._mapPane);

		if (name) {
			this._panes[name] = pane;
		}
		return pane;
	},

	// @section Methods for Getting Map State

	// @method getCenter(): LatLng
	// 返回地图视图的地理中心坐标。
	getCenter: function () {
		this._checkIfLoaded();

		if (this._lastCenter && !this._moved()) {
			return this._lastCenter.clone();
		}
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	// @method getZoom(): Number
	// 返回地图视图当前的缩放级别。
	getZoom: function () {
		return this._zoom;
	},

	// @method getBounds(): LatLngBounds
	// 返回当前地图视图中可见的地理范围。
	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new LatLngBounds(sw, ne);
	},

	// @method getMinZoom(): Number
	// 返回地图的最小缩放级别（如果在地图或任何图层的 `minZoom` 选项中设置），默认值为 `0`。
	getMinZoom: function () {
		return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
	},

	// @method getMaxZoom(): Number
	// 返回地图的最大缩放级别（如果在地图或任何图层的 `maxZoom` 选项中设置）。
	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	// @method getBoundsZoom(bounds: LatLngBounds, inside?: Boolean, padding?: Point): Number
	// 返回给定范围在地图上能够完整显示的最大缩放级别。如果设置 `inside`（可选）为 `true`，则方法
	// view in its entirety. If `inside` (optional) is set to `true`, the method
	// 而是返回地图视图能够在
	// 给定范围内完整显示的最小缩放级别。
	getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
		bounds = toLatLngBounds(bounds);
		padding = toPoint(padding || [0, 0]);

		var zoom = this.getZoom() || 0,
		    min = this.getMinZoom(),
		    max = this.getMaxZoom(),
		    nw = bounds.getNorthWest(),
		    se = bounds.getSouthEast(),
		    size = this.getSize().subtract(padding),
		    boundsSize = toBounds(this.project(se, zoom), this.project(nw, zoom)).getSize(),
		    snap = Browser.any3d ? this.options.zoomSnap : 1,
		    scalex = size.x / boundsSize.x,
		    scaley = size.y / boundsSize.y,
		    scale = inside ? Math.max(scalex, scaley) : Math.min(scalex, scaley);

		zoom = this.getScaleZoom(scale, zoom);

		if (snap) {
			zoom = Math.round(zoom / (snap / 100)) * (snap / 100); // don't jump if within 1% of a snap level
			zoom = inside ? Math.ceil(zoom / snap) * snap : Math.floor(zoom / snap) * snap;
		}

		return Math.max(min, Math.min(max, zoom));
	},

	// @method getSize(): Point
	// 返回地图容器当前的尺寸（以像素为单位）。
	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new Point(
				this._container.clientWidth || 0,
				this._container.clientHeight || 0);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	// @method getPixelBounds(): Bounds
	// 返回当前地图视图在投影像素坐标下的边界范围
	// （这在层和覆盖层实现中有时很有用）
	getPixelBounds: function (center, zoom) {
		var topLeftPoint = this._getTopLeftPoint(center, zoom);
		return new Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	// TODO：检查语义——像素原点是否相对于
	// 地图窗格的0,0坐标？“地图层的左点”可能会令人困惑，尤其是
	// 因为可能存在负偏移量。
	// @method getPixelOrigin(): Point
	// 返回地图层左上点的投影像素坐标
	// （在自定义层和覆盖层实现中很有用）
	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._pixelOrigin;
	},

	// @method getPixelWorldBounds(zoom?: Number): Bounds
	// 返回世界范围在`zoom`级别的像素坐标下的值
	// 如果省略`zoom`，则使用地图当前的缩放级别。
	getPixelWorldBounds: function (zoom) {
		return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
	},

	// @section Other Methods

	// @method getPane(pane: String|HTMLElement): HTMLElement
	// 根据名称或HTML元素（其身份）返回[地图窗格](#地图-pane)
	getPane: function (pane) {
		return typeof pane === 'string' ? this._panes[pane] : pane;
	},

	// @method getPanes(): Object
	// 返回一个普通对象，包含所有[窗格](#地图-pane)的名称作为键，
	// 窗格作为值。
	getPanes: function () {
		return this._panes;
	},

	// @method getContainer: HTMLElement
	// 返回包含地图的HTML元素。
	getContainer: function () {
		return this._container;
	},


	// @section Conversion Methods

	// @method getZoomScale(toZoom: Number, fromZoom: Number): Number
	// 返回在从`fromZoom`到`toZoom`的缩放级别之间应用于地图的缩放因子
	// 用于内部帮助缩放动画。
	getZoomScale: function (toZoom, fromZoom) {
		// TODO：重构投影后替换为通用实现
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return crs.scale(toZoom) / crs.scale(fromZoom);
	},

	// @method getScaleZoom(scale: Number, fromZoom: Number): Number
	// 如果处于`fromZoom`级别且所有内容都按`scale`比例缩放，则返回地图最终达到的缩放级别
	// 级别以及整体按`scale`比例缩放。
	// [`getZoomScale`](#map-getZoomScale).
	getScaleZoom: function (scale, fromZoom) {
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		var zoom = crs.zoom(scale * crs.scale(fromZoom));
		return isNaN(zoom) ? Infinity : zoom;
	},

	// @method project(latlng: LatLng, zoom: Number): Point
	// 根据地图CRS的投影将地理坐标`LatLng`进行投影，
	// 然后根据`zoom`和CRS的
	// `Transformation`进行缩放。结果为相对于
	// CRS原点的像素坐标。
	project: function (latlng, zoom) {
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.latLngToPoint(toLatLng(latlng), zoom);
	},

	// @method unproject(point: Point, zoom: Number): LatLng
	// 是 [`project`](#地图-project)的逆操作。
	unproject: function (point, zoom) {
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(toPoint(point), zoom);
	},

	// @method layerPointToLatLng(point: Point): LatLng
	// 给定相对于[原点像素](#地图-getpixelorigin)的像素坐标，
	// 返回对应的地理坐标（针对当前缩放级别）。
	layerPointToLatLng: function (point) {
		var projectedPoint = toPoint(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	// @method latLngToLayerPoint(latlng: LatLng): Point
	// 给定地理坐标，返回对应的像素坐标
	// 相对于[原点像素](#地图-getpixelorigin)。
	latLngToLayerPoint: function (latlng) {
		var projectedPoint = this.project(toLatLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	// @method wrapLatLng(latlng: LatLng): LatLng
	// 返回一个`LatLng`，其中`lat`和`lng`根据
	// 地图CRS的`wrapLat`和`wrapLng`属性进行包装，如果它们超出
	// CRS范围则如此。
	// 默认情况下这意味着经度在数据线周围进行包装。
	// 值介于 -180 度至 +180 度之间。
	wrapLatLng: function (latlng) {
		return this.options.crs.wrapLatLng(toLatLng(latlng));
	},

	// @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
	// 返回一个与给定范围大小相同的 `LatLngBounds`，确保
	// 其中心位于 CRS 的边界内。
	// 默认情况下，这意味着中心经度在数据线处循环，因此其值介于 -180 度至 +180 度之间，大部分边界
	// value is between -180 and +180 degrees, and the majority of the 边界
	// 与 CRS 的边界相重叠。
	wrapLatLngBounds: function (latlng) {
		return this.options.crs.wrapLatLngBounds(toLatLngBounds(latlng));
	},

	// @method distance(latlng1: LatLng, latlng2: LatLng): Number
	// 根据地图 CRS 计算两个地理坐标之间的距离。默认情况下，此距离以米为单位。
	// the 地图's CRS. By default this measures distance in meters.
	distance: function (latlng1, latlng2) {
		return this.options.crs.distance(toLatLng(latlng1), toLatLng(latlng2));
	},

	// @method containerPointToLayerPoint(point: Point): Point
	// 给定相对于地图容器的一像素坐标，返回对应的
	// 相对于 [原点像素](#地图-getpixelorigin) 的一像素坐标。
	containerPointToLayerPoint: function (point) { // (Point)
		return toPoint(point).subtract(this._getMapPanePos());
	},

	// @method layerPointToContainerPoint(point: Point): Point
	// 给定相对于 [原点像素](#地图-getpixelorigin) 的一像素坐标，
	// 返回相对于地图容器的对应一像素坐标。
	layerPointToContainerPoint: function (point) { // (Point)
		return toPoint(point).add(this._getMapPanePos());
	},

	// @method containerPointToLatLng(point: Point): LatLng
	// 给定相对于地图容器的一像素坐标，返回对应的
	// 当前缩放级别下的地理坐标。
	containerPointToLatLng: function (point) {
		var layerPoint = this.containerPointToLayerPoint(toPoint(point));
		return this.layerPointToLatLng(layerPoint);
	},

	// @method latLngToContainerPoint(latlng: LatLng): Point
	// 给定地理坐标，返回对应的相对于地图容器的像素坐标。
	// 相对于地图容器的一像素坐标。
	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(toLatLng(latlng)));
	},

	// @method mouseEventToContainerPoint(ev: MouseEvent): Point
	// 给定 `MouseEvent` 对象，返回事件发生的位置相对于
	// 地图容器的像素坐标。
	mouseEventToContainerPoint: function (e) {
		return DomEvent.getMousePosition(e, this._container);
	},

	// @method mouseEventToLayerPoint(ev: MouseEvent): Point
	// 给定 `MouseEvent` 对象，返回事件发生的位置相对于
	// [原点像素](#地图-getpixelorigin) 的像素坐标。
	mouseEventToLayerPoint: function (e) {
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	// @method mouseEventToLatLng(ev: MouseEvent): LatLng
	// 给定 `MouseEvent` 对象，返回事件发生的地理坐标。
	// 地图初始化方法
	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},


	// 地图 initialization methods

	_initContainer: function (id) {
		var container = this._container = DomUtil.get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet_id) {
			throw new Error('Map container is already initialized.');
		}

		DomEvent.on(container, 'scroll', this._onScroll, this);
		this._containerId = Util.stamp(container);
	},

	_initLayout: function () {
		var container = this._container;

		this._fadeAnimated = this.options.fadeAnimation && Browser.any3d;

		DomUtil.addClass(container, 'leaflet-container' +
			(Browser.touch ? ' leaflet-touch' : '') +
			(Browser.retina ? ' leaflet-retina' : '') +
			(Browser.ielt9 ? ' leaflet-oldie' : '') +
			(Browser.safari ? ' leaflet-safari' : '') +
			(this._fadeAnimated ? ' leaflet-fade-anim' : ''));

		var position = DomUtil.getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed' && position !== 'sticky') {
			container.style.position = 'relative';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};
		this._paneRenderers = {};

		// @section
		//
		// 面板是用于控制地图上图层顺序的 DOM 元素。您可以通过
		// 使用 [`map.getPane`](#地图-getpane) 访问面板或
		// [`map.getPanes`](#map-getpanes) methods. New panes can be created with the
		// [`map.createPane`](#map-createpane) method.
		//
		// 每个地图都有以下默认面板，仅 `zIndex` 不同。
		//
		// @pane mapPane: HTMLElement = 'auto'
		// 包含所有其他地图面板的面板

		this._mapPane = this.createPane('mapPane', this._container);
		DomUtil.setPosition(this._mapPane, new Point(0, 0));

		// @pane tilePane: HTMLElement = 200
		// 用于 `GridLayer` 和 `TileLayer` 的面板
		this.createPane('tilePane');
		// @pane overlayPane: HTMLElement = 400
		// 用于向量（`Path`，如 `Polyline` 和 `Polygon`）、`ImageOverlay` 和 `VideoOverlay` 的面板
		this.createPane('overlayPane');
		// @pane shadowPane: HTMLElement = 500
		// 用于覆盖阴影（例如 `Marker` 阴影）的面板
		this.createPane('shadowPane');
		// @pane markerPane: HTMLElement = 600
		// 用于 `Marker` 图标的面板
		this.createPane('markerPane');
		// @pane tooltipPane: HTMLElement = 650
		// 用于 `Tooltip` 的面板。
		this.createPane('tooltipPane');
		// @pane popupPane: HTMLElement = 700
		// 用于 `Popup` 的面板。
		this.createPane('popupPane');

		if (!this.options.markerZoomAnimation) {
			DomUtil.addClass(panes.markerPane, 'leaflet-zoom-hide');
			DomUtil.addClass(panes.shadowPane, 'leaflet-zoom-hide');
		}
	},


	// 修改地图状态的私有方法

	// @section Map state change events
	_resetView: function (center, zoom, noMoveStart) {
		DomUtil.setPosition(this._mapPane, new Point(0, 0));

		var loading = !this._loaded;
		this._loaded = true;
		zoom = this._limitZoom(zoom);

		this.fire('viewprereset');

		var zoomChanged = this._zoom !== zoom;
		this
			._moveStart(zoomChanged, noMoveStart)
			._move(center, zoom)
			._moveEnd(zoomChanged);

		// @event viewreset: Event
		// 在地图需要重新绘制内容时触发（通常发生在
		// 地图缩放或加载时）。非常适用于创建自定义覆盖层。
		this.fire('viewreset');

		// @event load: Event
		// 在地图初始化时触发（当其中心和缩放级别
		// 首次设置时）。
		if (loading) {
			this.fire('load');
		}
	},

	_moveStart: function (zoomChanged, noMoveStart) {
		// @event zoomstart: Event
		// 在地图缩放即将改变时触发（例如，在缩放动画之前）。
		// @event movestart: Event
		// 在地图视图开始变化时触发（例如，用户开始拖动地图）。
		if (zoomChanged) {
			this.fire('zoomstart');
		}
		if (!noMoveStart) {
			this.fire('movestart');
		}
		return this;
	},

	_move: function (center, zoom, data, supressEvent) {
		if (zoom === undefined) {
			zoom = this._zoom;
		}
		var zoomChanged = this._zoom !== zoom;

		this._zoom = zoom;
		this._lastCenter = center;
		this._pixelOrigin = this._getNewPixelOrigin(center);

		if (!supressEvent) {
			// @event zoom: Event
			// 在任何缩放级别发生变化期间反复触发，
			// 包括缩放和飞行动画。
			if (zoomChanged || (data && data.pinch)) {	// Always fire 'zoom' if pinching because #3530
				this.fire('zoom', data);
			}

			// @event move: Event
			// 在地图任何移动过程中反复触发，
			// 包括平移和飞行动画。
			this.fire('move', data);
		} else if (data && data.pinch) {	// Always fire 'zoom' if pinching because #3530
			this.fire('zoom', data);
		}
		return this;
	},

	_moveEnd: function (zoomChanged) {
		// @event zoomend: Event
		// 在地图缩放改变后，无论是否经过动画处理都会触发。
		if (zoomChanged) {
			this.fire('zoomend');
		}

		// @event moveend: Event
		// 当地图中心不再变化时触发
		// （例如，用户停止拖动地图或非居中缩放后）。
		return this.fire('moveend');
	},

	_stop: function () {
		Util.cancelAnimFrame(this._flyToFrame);
		if (this._panAnim) {
			this._panAnim.stop();
		}
		return this;
	},

	_rawPanBy: function (offset) {
		DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_panInsideMaxBounds: function () {
		if (!this._enforcingBounds) {
			this.panInsideBounds(this.options.maxBounds);
		}
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// DOM 事件处理

	// @section Interaction events
	_initEvents: function (remove) {
		this._targets = {};
		this._targets[Util.stamp(this._container)] = this;

		var onOff = remove ? DomEvent.off : DomEvent.on;

		// @event click: MouseEvent
		// 当用户点击（或轻触）地图时触发。
		// @event dblclick: MouseEvent
		// 当用户双击（或双轻触）地图时触发。
		// @event mousedown: MouseEvent
		// 当用户在地图上按下鼠标按钮时触发。
		// @event mouseup: MouseEvent
		// 当用户在地图上释放鼠标按钮时触发。
		// @event mouseover: MouseEvent
		// 当鼠标进入地图时触发。
		// @event mouseout: MouseEvent
		// 当鼠标离开地图时触发。
		// @event mousemove: MouseEvent
		// 当鼠标在地图上移动时触发。
		// @event contextmenu: MouseEvent
		// 当用户在地图上按下右键时触发，可防止
		// 如果有监听器存在时默认浏览器上下文菜单显示。在移动设备上，当用户保持单次触摸
		// this event. Also fired on mobile when the user holds a single touch
		// 持续一秒（也称为长按）时也会触发。
		// @event keypress: KeyboardEvent
		// 当用户在地图处于焦点状态时按键盘上的键产生字符值时触发。
		// @event keydown: KeyboardEvent
		// 当用户在地图处于焦点状态时按键盘上的键时触发。与 `keypress` 事件不同，
		// `keydown` 事件适用于产生字符值的键以及
		// 不产生字符值的键。
		// @event keyup: KeyboardEvent
		// 当在地图处于焦点状态时用户释放键盘上的键时触发。
		onOff(this._container, 'click dblclick mousedown mouseup ' +
			'mouseover mouseout mousemove contextmenu keypress keydown keyup', this._handleDOMEvent, this);

		if (this.options.trackResize) {
			onOff(window, 'resize', this._onResize, this);
		}

		if (Browser.any3d && this.options.transform3DLimit) {
			(remove ? this.off : this.on).call(this, 'moveend', this._onMoveEnd);
		}
	},

	_onResize: function () {
		Util.cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = Util.requestAnimFrame(
		        function () { this.invalidateSize({debounceMoveend: true}); }, this);
	},

	_onScroll: function () {
		this._container.scrollTop  = 0;
		this._container.scrollLeft = 0;
	},

	_onMoveEnd: function () {
		var pos = this._getMapPanePos();
		if (Math.max(Math.abs(pos.x), Math.abs(pos.y)) >= this.options.transform3DLimit) {
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1203873，但 Webkit 也有
			// 在非常高的数值下会出现像素偏移，参见：https://jsfiddle.net/dg6r5hhb/
			this._resetView(this.getCenter(), this.getZoom());
		}
	},

	_findEventTargets: function (e, type) {
		var targets = [],
		    target,
		    isHover = type === 'mouseout' || type === 'mouseover',
		    src = e.target || e.srcElement,
		    dragging = false;

		while (src) {
			target = this._targets[Util.stamp(src)];
			if (target && (type === 'click' || type === 'preclick') && this._draggableMoved(target)) {
				// 防止在刚刚拖动对象后触发点击事件。
				dragging = true;
				break;
			}
			if (target && target.listens(type, true)) {
				if (isHover && !DomEvent.isExternalTarget(src, e)) { break; }
				targets.push(target);
				if (isHover) { break; }
			}
			if (src === this._container) { break; }
			src = src.parentNode;
		}
		if (!targets.length && !dragging && !isHover && this.listens(type, true)) {
			targets = [this];
		}
		return targets;
	},

	_isClickDisabled: function (el) {
		while (el && el !== this._container) {
			if (el['_leaflet_disable_click']) { return true; }
			el = el.parentNode;
		}
	},

	_handleDOMEvent: function (e) {
		var el = (e.target || e.srcElement);
		if (!this._loaded || el['_leaflet_disable_events'] || e.type === 'click' && this._isClickDisabled(el)) {
			return;
		}

		var type = e.type;

		if (type === 'mousedown') {
			// 防止在点击键盘可聚焦元素时显示轮廓线。
			DomUtil.preventOutline(el);
		}

		this._fireDOMEvent(e, type);
	},

	_mouseEvents: ['click', 'dblclick', 'mouseover', 'mouseout', 'contextmenu'],

	_fireDOMEvent: function (e, type, canvasTargets) {

		if (e.type === 'click') {
			// 触发一个合成的‘preclick’事件，该事件会向上传播（主要用于关闭弹出窗口）。
			// @event preclick: MouseEvent
			// 在地图上的鼠标点击之前触发此事件（当您希望
			// 在现有处理程序开始运行之前发生某些事情时很有用）。
			// 找到事件传播的层及其父层。
			var synth = Util.extend({}, e);
			synth.type = 'preclick';
			this._fireDOMEvent(synth, synth.type, canvasTargets);
		}

		// Find the 图层 the event is propagating from and its parents.
		var targets = this._findEventTargets(e, type);

		if (canvasTargets) {
			var filtered = []; // pick only targets with listeners
			for (var i = 0; i < canvasTargets.length; i++) {
				if (canvasTargets[i].listens(type, true)) {
					filtered.push(canvasTargets[i]);
				}
			}
			targets = filtered.concat(targets);
		}

		if (!targets.length) { return; }

		if (type === 'contextmenu') {
			DomEvent.preventDefault(e);
		}

		var target = targets[0];
		var data = {
			originalEvent: e
		};

		if (e.type !== 'keypress' && e.type !== 'keydown' && e.type !== 'keyup') {
			var isMarker = target.getLatLng && (!target._radius || target._radius <= 10);
			data.containerPoint = isMarker ?
				this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
			data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
			data.latlng = isMarker ? target.getLatLng() : this.layerPointToLatLng(data.layerPoint);
		}

		for (i = 0; i < targets.length; i++) {
			targets[i].fire(type, data, true);
			if (data.originalEvent._stopped ||
				(targets[i].options.bubblingMouseEvents === false && Util.indexOf(this._mouseEvents, type) !== -1)) { return; }
		}
	},

	_draggableMoved: function (obj) {
		obj = obj.dragging && obj.dragging.enabled() ? obj : this;
		return (obj.dragging && obj.dragging.moved()) || (this.boxZoom && this.boxZoom.moved());
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	// @section Other Methods

	// @method whenReady(fn: Function, context?: Object): this
	// 在地图初始化时，当存在视图（中心和缩放）以及至少一层时，或立即
	// a view (center and zoom) and at least one 图层, or immediately
	// 如果已经初始化，可以可选地传递函数上下文，从而调用给定的函数 `fn`。
	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, {target: this});
		} else {
			this.on('load', callback, context);
		}
		return this;
	},


	// 获取地图状态的私有方法。

	_getMapPanePos: function () {
		return DomUtil.getPosition(this._mapPane) || new Point(0, 0);
	},

	_moved: function () {
		var pos = this._getMapPanePos();
		return pos && !pos.equals([0, 0]);
	},

	_getTopLeftPoint: function (center, zoom) {
		var pixelOrigin = center && zoom !== undefined ?
			this._getNewPixelOrigin(center, zoom) :
			this.getPixelOrigin();
		return pixelOrigin.subtract(this._getMapPanePos());
	},

	_getNewPixelOrigin: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
	},

	_latLngToNewLayerPoint: function (latlng, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return this.project(latlng, zoom)._subtract(topLeft);
	},

	_latLngBoundsToNewLayerBounds: function (latLngBounds, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return toBounds([
			this.project(latLngBounds.getSouthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getSouthEast(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthEast(), zoom)._subtract(topLeft)
		]);
	},

	// 当前中心的层点。
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	},

	// 指定位置相对于当前中心的像素偏移量。
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// 调整中心位置以使其位于边界内。
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		// 如果偏移量小于一像素，则忽略该情况。
		// 这可以防止不稳定的投影导致
		// 无限循环的小幅偏移。
		if (Math.abs(offset.x) <= 1 && Math.abs(offset.y) <= 1) {
			return center;
		}

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// 调整偏移量以使视图位于边界内。
	_limitOffset: function (offset, bounds) {
		if (!bounds) { return offset; }

		var viewBounds = this.getPixelBounds(),
		    newBounds = new Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	},

	// 返回在指定缩放比例下使 pxBounds 位于 maxBounds 所需的偏移量。
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var projectedMaxBounds = toBounds(
		        this.project(maxBounds.getNorthEast(), zoom),
		        this.project(maxBounds.getSouthWest(), zoom)
		    ),
		    minOffset = projectedMaxBounds.min.subtract(pxBounds.min),
		    maxOffset = projectedMaxBounds.max.subtract(pxBounds.max),

		    dx = this._rebound(minOffset.x, -maxOffset.x),
		    dy = this._rebound(minOffset.y, -maxOffset.y);

		return new Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom(),
		    snap = Browser.any3d ? this.options.zoomSnap : 1;
		if (snap) {
			zoom = Math.round(zoom / snap) * snap;
		}
		return Math.max(min, Math.min(max, zoom));
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		DomUtil.removeClass(this._mapPane, 'leaflet-pan-anim');
		this.fire('moveend');
	},

	_tryAnimatedPan: function (center, options) {
		// 新中心和当前中心之间的像素差异。
		var offset = this._getCenterOffset(center)._trunc();

		// 除非选项中指定了 animate: true，否则不要过度动画化。
		if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

		this.panBy(offset, options);

		return true;
	},

	_createAnimProxy: function () {

		var proxy = this._proxy = DomUtil.create('div', 'leaflet-proxy leaflet-zoom-animated');
		this._panes.mapPane.appendChild(proxy);

		this.on('zoomanim', function (e) {
			var prop = DomUtil.TRANSFORM,
			    transform = this._proxy.style[prop];

			DomUtil.setTransform(this._proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));

			// 当变换相同且 transitionend 事件未触发时的解决方案。
			if (transform === this._proxy.style[prop] && this._animatingZoom) {
				this._onZoomTransitionEnd();
			}
		}, this);

		this.on('load moveend', this._animMoveEnd, this);

		this._on('unload', this._destroyAnimProxy, this);
	},

	_destroyAnimProxy: function () {
		DomUtil.remove(this._proxy);
		this.off('load moveend', this._animMoveEnd, this);
		delete this._proxy;
	},

	_animMoveEnd: function () {
		var c = this.getCenter(),
		    z = this.getZoom();
		DomUtil.setTransform(this._proxy, this.project(c, z), this.getZoomScale(z, 1));
	},

	_catchTransitionEnd: function (e) {
		if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
			this._onZoomTransitionEnd();
		}
	},

	_nothingToAnimate: function () {
		return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
	},

	_tryAnimatedZoom: function (center, zoom, options) {

		if (this._animatingZoom) { return true; }

		options = options || {};

		// 如果禁用、不受支持或缩放差异过大，则不进行动画。
		if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
		        Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

		// 偏移量是缩放原点相对于当前中心的像素坐标。
		var scale = this.getZoomScale(zoom),
		    offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale);

		// 如果缩放原点不在当前中心附近一个屏幕范围内，则不进行动画，除非被强制要求。
		if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

		Util.requestAnimFrame(function () {
			this
			    ._moveStart(true, options.noMoveStart || false)
			    ._animateZoom(center, zoom, true);
		}, this);

		return true;
	},

	_animateZoom: function (center, zoom, startAnim, noUpdate) {
		if (!this._mapPane) { return; }

		if (startAnim) {
			this._animatingZoom = true;

			// 记住动画结束后应设置的中心/缩放值。
			this._animateToCenter = center;
			this._animateToZoom = zoom;

			DomUtil.addClass(this._mapPane, 'leaflet-zoom-anim');
		}

		// @section Other Events
		// @event zoomanim: ZoomAnimEvent
		// 在每次缩放动画中至少触发一次。对于连续缩放，如捏合缩放，在缩放过程中每帧触发一次。
		this.fire('zoomanim', {
			center: center,
			zoom: zoom,
			noUpdate: noUpdate
		});

		if (!this._tempFireZoomEvent) {
			this._tempFireZoomEvent = this._zoom !== this._animateToZoom;
		}

		this._move(this._animateToCenter, this._animateToZoom, undefined, true);

		// 针对 webkit 不触发 ‘transitionend’ 事件的解决方案，参见 https://github.com/Leaflet/Leaflet/issues/3689, 2693。
		setTimeout(Util.bind(this._onZoomTransitionEnd, this), 250);
	},

	_onZoomTransitionEnd: function () {
		if (!this._animatingZoom) { return; }

		if (this._mapPane) {
			DomUtil.removeClass(this._mapPane, 'leaflet-zoom-anim');
		}

		this._animatingZoom = false;

		this._move(this._animateToCenter, this._animateToZoom, undefined, true);

		if (this._tempFireZoomEvent) {
			this.fire('zoom');
		}
		delete this._tempFireZoomEvent;

		this.fire('move');

		this._moveEnd(true);
	}
});

// @section

// @factory L.map(id: String, options?: Map options)
// 根据 `<div>` 元素的 DOM ID 实例化地图对象。
// 以及可选的包含 `Map 选项` 的对象字面量。
//
// @alternative
// @factory L.map(el: HTMLElement, options?: Map options)
// 根据一个 `<div>` HTML 元素的实例来实例化地图对象。
// 以及可选的包含 `Map 选项` 的对象字面量。
export function createMap(id, options) {
	return new Map(id, options);
}
