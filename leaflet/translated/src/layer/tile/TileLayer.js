import {GridLayer} from './GridLayer';
import Browser from '../../core/Browser';
import * as Util from '../../core/Util';
import * as DomEvent from '../../dom/DomEvent';
import * as DomUtil from '../../dom/DomUtil';


/*
 * @class TileLayer
 * @inherits GridLayer
 * @aka L.TileLayer
 * 用于加载和显示地图上的瓦片层。注意，大多数瓦片服务器要求注明来源，该设置可在 `Layer` 中完成。继承自 `GridLayer`。
 *
 * @example
 *
 * ```js
 * L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', {foo: 'bar', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 * ```
 *
 * @section URL template
 * @example
 *
 * A string of the following form:
 *
 * ```
 * 'https://{s}.somedomain.com/blabla/{z}/{x}/{y}{r}.png'
 * ```
 *
 * `{s}` means one of the available subdomains (used sequentially to help with browser parallel requests per domain limitation; subdomain values are specified in options; `a`, `b` or `c` by default, can be omitted), `{z}` — zoom level, `{x}` and `{y}` — tile coordinates. `{r}` can be used to add "&commat;2x" to the URL to load retina tiles.
 *
 * You can use custom keys in the template, which will be [evaluated](#util-template) from TileLayer options, like this:
 *
 * ```
 * L.tileLayer('https://{s}.somedomain.com/{foo}/{z}/{x}/{y}.png', {foo: 'bar'});
 * ```
 */


export var TileLayer = GridLayer.extend({

	// @section
	// @aka TileLayer options
	options: {
		// @option minZoom: Number = 0
		// 此层将被显示的最低缩放级别（包含该值）。
		minZoom: 0,

		// @option maxZoom: Number = 18
		// 此层将被显示的最高缩放级别（包含该值）。
		maxZoom: 18,

		// @option subdomains: String|String[] = 'abc'
		// 瓦片服务中的子域。可以以字符串形式传递（其中每个字母都是子域名），也可以以字符串数组的形式传递。
		subdomains: 'abc',

		// @option errorTileUrl: String = ''
		// 用于替代无法加载的瓦片的图像URL。
		errorTileUrl: '',

		// @option zoomOffset: Number = 0
		// 瓦片URL中使用的缩放数值将与此值偏移。
		zoomOffset: 0,

		// @option tms: Boolean = false
		// 如果设置为 `true`，则反转瓦片的Y轴编号（适用于 [TMS](https://en.wikipedia.org/wiki/Tile_Map_Service) 服务）。
		tms: false,

		// @option zoomReverse: Boolean = false
		// 如果设置为 `true`，则瓦片URL中使用的缩放数值将被反转（`maxZoom - zoom` 代替 `zoom`）。
		zoomReverse: false,

		// @option detectRetina: Boolean = false
		// 如果设置为 `true` 且用户使用视网膜显示屏，将请求四个尺寸为指定大小一半的瓦片以及更高的缩放级别，以利用高分辨率。
		detectRetina: false,

		// @option crossOrigin: Boolean|String = false
		// 是否将在瓦片上添加 `crossOrigin` 属性。
		// 如果提供字符串，所有瓦片的 `crossOrigin` 属性都将设置为提供的字符串。如果需要访问瓦片像素数据，则需要此设置。
		// 有效的字符串值请参考 [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes)。
		crossOrigin: false,

		// @option referrerPolicy: Boolean|String = false
		// 是否将在瓦片上添加 `referrerPolicy` 属性。
		// 如果提供字符串，所有瓦片的 `referrerPolicy` 属性都将设置为提供的字符串。
		// 如果地图的渲染上下文有严格的默认设置，而瓦片提供商期望有效的引用源，则可能需要此设置。
		// （例如，用于验证API令牌）。
		// 有效的字符串值请参考 [HTMLImageElement.referrerPolicy](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/referrerPolicy)。
		referrerPolicy: false
	},

	initialize: function (url, options) {

		this._url = url;

		options = Util.setOptions(this, options);

		// 检测视网膜显示屏，调整瓦片大小和缩放级别。
		if (options.detectRetina && Browser.retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);

			if (!options.zoomReverse) {
				options.zoomOffset++;
				options.maxZoom = Math.max(options.minZoom, options.maxZoom - 1);
			} else {
				options.zoomOffset--;
				options.minZoom = Math.min(options.maxZoom, options.minZoom + 1);
			}

			options.minZoom = Math.max(0, options.minZoom);
		} else if (!options.zoomReverse) {
			// 确保 `maxZoom` 不小于 `minZoom`。
			options.maxZoom = Math.max(options.minZoom, options.maxZoom);
		} else {
			// 确保 `minZoom` 不大于 `maxZoom`。
			options.minZoom = Math.min(options.maxZoom, options.minZoom);
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		this.on('tileunload', this._onTileRemove);
	},

	// @method setUrl(url: String, noRedraw?: Boolean): this
	// 更新层的URL模板并重新绘制（除非将 `noRedraw` 设置为 `true`）。
	// 如果 URL 没有变化，则不会重新绘制图层，除非
	// 将 noRedraw 参数设置为 false。
	setUrl: function (url, noRedraw) {
		if (this._url === url && noRedraw === undefined) {
			noRedraw = true;
		}

		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	// @method createTile(coords: Object, done?: Function): HTMLElement
	// 仅内部调用，覆盖 GridLayer 的 [`createTile()`](#gridlayer-createtile)
	// 以返回带有给定 `coords` 的适当图像 URL 的 `<img>` HTML 元素。当 tiles 加载完成后
	// 回调。
	createTile: function (coords, done) {
		var tile = document.createElement('img');

		DomEvent.on(tile, 'load', Util.bind(this._tileOnLoad, this, done, tile));
		DomEvent.on(tile, 'error', Util.bind(this._tileOnError, this, done, tile));

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		}

		// 对于此新选项，我们更严格地遵循文档中的行为
		// 仅在属性为字符串时设置该属性。
		if (typeof this.options.referrerPolicy === 'string') {
			tile.referrerPolicy = this.options.referrerPolicy;
		}

		// alt 属性被设置为空字符串，
		// 使屏幕阅读器能够忽略装饰性图像 tiles。
		// https://www.w3.org/WAI/tutorials/images/decorative/
		// https://www.w3.org/TR/html-aria/#el-img-empty-alt
		tile.alt = '';

		tile.src = this.getTileUrl(coords);

		return tile;
	},

	// @section Extension methods
	// @uninheritable
	// 扩展 `TileLayer` 的图层可能会重新实现以下方法。
	// @method getTileUrl(coords: Object): String
	// 仅内部调用，返回给定坐标的 tiles 的 URL。
	// 扩展 `TileLayer` 的类可以覆盖此函数以提供自定义的 tiles URL 命名方案。
	getTileUrl: function (coords) {
		var data = {
			r: Browser.retina ? '@2x' : '',
			s: this._getSubdomain(coords),
			x: coords.x,
			y: coords.y,
			z: this._getZoomForUrl()
		};
		if (this._map && !this._map.options.crs.infinite) {
			var invertedY = this._globalTileRange.max.y - coords.y;
			if (this.options.tms) {
				data['y'] = invertedY;
			}
			data['-y'] = invertedY;
		}

		return Util.template(this._url, Util.extend(data, this.options));
	},

	_tileOnLoad: function (done, tile) {
		// 关于 https://github.com/Leaflet/Leaflet/issues/3332
		if (Browser.ielt9) {
			setTimeout(Util.bind(done, this, null, tile), 0);
		} else {
			done(null, tile);
		}
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl && tile.getAttribute('src') !== errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_getZoomForUrl: function () {
		var zoom = this._tileZoom,
		maxZoom = this.options.maxZoom,
		zoomReverse = this.options.zoomReverse,
		zoomOffset = this.options.zoomOffset;

		if (zoomReverse) {
			zoom = maxZoom - zoom;
		}

		return zoom + zoomOffset;
	},

	_getSubdomain: function (tilePoint) {
		var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	},

	// 会在后台图层中停止加载所有 tiles。
	_abortLoading: function () {
		var i, tile;
		for (i in this._tiles) {
			if (this._tiles[i].coords.z !== this._tileZoom) {
				tile = this._tiles[i].el;

				tile.onload = Util.falseFn;
				tile.onerror = Util.falseFn;

				if (!tile.complete) {
					tile.src = Util.emptyImageUrl;
					var coords = this._tiles[i].coords;
					DomUtil.remove(tile);
					delete this._tiles[i];
					// @event tileabort: TileEvent
					// 当 tiles 正在加载但不再需要时触发。
					this.fire('tileabort', {
						tile: tile,
						coords: coords
					});
				}
			}
		}
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

		// 取消与 tiles 相关的任何待处理 http 请求。
		tile.el.setAttribute('src', Util.emptyImageUrl);

		return GridLayer.prototype._removeTile.call(this, key);
	},

	_tileReady: function (coords, err, tile) {
		if (!this._map || (tile && tile.getAttribute('src') === Util.emptyImageUrl)) {
			return;
		}

		return GridLayer.prototype._tileReady.call(this, coords, err, tile);
	}
});


// @factory L.tilelayer(urlTemplate: String, options?: TileLayer options)
// 根据 `URL template` 和可选的选项对象实例化一个 tiles 层对象。

export function tileLayer(url, options) {
	return new TileLayer(url, options);
}
