import {Layer} from '../Layer';
import Browser from '../../core/Browser';
import * as Util from '../../core/Util';
import * as DomUtil from '../../dom/DomUtil';
import {Point} from '../../geometry/Point';
import {Bounds} from '../../geometry/Bounds';
import {LatLngBounds, toLatLngBounds as latLngBounds} from '../../geo/LatLngBounds';

/*
 * @class GridLayer
 * @inherits Layer
 * @aka L.GridLayer
 *
 * 处理 HTML 元素平铺网格的通用类。这是所有瓦片层的基类，取代了 `TileLayer.Canvas`。
 * GridLayer 可以扩展以创建类似 `<canvas>`、`<img>` 或 `<div>` 的 HTML 元素平铺网格。GridLayer 会自动处理这些 DOM 元素的创建与动画效果。
 *
 *
 * @section Synchronous usage
 * @example
 *
 * To create a custom layer, extend GridLayer and implement the `createTile()` method, which will be passed a `Point` object with the `x`, `y`, and `z` (zoom level) coordinates to draw your tile.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords){
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // get a canvas context and draw something on it using coords.x, coords.y and coords.z
 *         var ctx = tile.getContext('2d');
 *
 *         // return the tile so it can be rendered on screen
 *         return tile;
 *     }
 * });
 * ```
 *
 * @section Asynchronous usage
 * @example
 *
 * Tile creation can also be asynchronous, this is useful when using a third-party drawing library. Once the tile is finished drawing it can be passed to the `done()` callback.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords, done){
 *         var error;
 *
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // draw something asynchronously and pass the tile to the done() callback
 *         setTimeout(function() {
 *             done(error, tile);
 *         }, 1000);
 *
 *         return tile;
 *     }
 * });
 * ```
 *
 * @section
 */


export var GridLayer = Layer.extend({

	// @section
	// @aka GridLayer options
	options: {
		// @option tileSize: Number|Point = 256
		// 网格中瓦片的宽度和高度。如果宽度和高度相等，则使用数字；否则使用 `L.point(width, height)`。
		tileSize: 256,

		// @option opacity: Number = 1.0
		// 瓦片的透明度。可在 `createTile()` 函数中使用。
		opacity: 1,

		// @option updateWhenIdle: Boolean = (depends)
		// 仅在平移结束后加载新瓦片。
		// 在移动浏览器上默认设置为 `true`，以避免过多请求并保持流畅的导航体验。
		// 否则设置为 `false`，以便在平移过程中显示新瓦片，因为容易在超出范围时进行平移。
		// [`keepBuffer`](#gridlayer-keepbuffer) option in desktop browsers.
		updateWhenIdle: Browser.mobile,

		// @option updateWhenZooming: Boolean = true
		// 默认情况下，平滑缩放动画（在 [触摸缩放](#地图-touchzoom) 或 [`flyTo()`](#地图-flyto）期间）会在每个整数缩放级别更新网格层。将此选项设置为 `false` 则仅在平滑动画结束时更新网格层。
		updateWhenZooming: true,

		// @option updateInterval: Number = 200
		// 平移过程中，瓦片不会每 `updateInterval` 毫秒更新超过一次。
		updateInterval: 200,

		// @option zIndex: Number = 1
		// 瓦片层的显式 zIndex 值。
		zIndex: 1,

		// @option bounds: LatLngBounds = undefined
		// 如果设置，则瓦片仅会在指定的 `LatLngBounds` 内加载。
		bounds: null,

		// @option minZoom: Number = 0
		// 此层显示的最低缩放级别（包含该级别）。
		minZoom: 0,

		// @option maxZoom: Number = undefined
		// 此层显示的最高缩放级别（包含该级别）。
		maxZoom: undefined,

		// @option maxNativeZoom: Number = undefined
		// 瓦片源可使用的最大缩放数。如果指定了此值，
		// 所有高于 `maxNativeZoom` 的缩放级别的瓦片将从 `maxNativeZoom` 级别加载并自动缩放。
		// from `maxNativeZoom` level and auto-scaled.
		maxNativeZoom: undefined,

		// @option minNativeZoom: Number = undefined
		// 瓦片源可使用的最小缩放数。如果指定了此值，
		// 所有低于 `minNativeZoom` 的缩放级别的瓦片将从 `minNativeZoom` 级别加载并自动缩放。
		// 是否围绕反子午线包裹层。如果为 `true`，则
		minNativeZoom: undefined,

		// @option noWrap: Boolean = false
		// Whether the 图层 is wrapped around the antimeridian. If `true`, the
		// GridLayer 仅在低缩放级别时显示一次。当 [地图坐标参考系](#地图-crs) 不环绕时，该设置没有
		// 影响。可以与 [`bounds`](#gridlayer-边界）结合使用，防止请求超出
		// in combination with [`bounds`](#gridlayer-边界) to prevent requesting
		// 坐标参考系限制范围的瓦片。
		noWrap: false,

		// @option pane: String = 'tilePane'
		// `Map pane`，此处将添加网格层。
		pane: 'tilePane',

		// @option className: String = ''
		// 分配给瓦片层的自定义类名。默认为空。
		className: '',

		// @option keepBuffer: Number = 2
		// 在平移地图时，保留此数量的行和列的瓦片再将其卸载。
		keepBuffer: 2
	},

	initialize: function (options) {
		Util.setOptions(this, options);
	},

	onAdd: function () {
		this._initContainer();

		this._levels = {};
		this._tiles = {};

		this._resetView(); // implicit _update() call
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
	},

	onRemove: function (map) {
		this._removeAllTiles();
		DomUtil.remove(this._container);
		map._removeZoomLimit(this);
		this._container = null;
		this._tileZoom = undefined;
	},

	// @method bringToFront: this
	// 将瓦片层置于所有瓦片层的最顶部。
	bringToFront: function () {
		if (this._map) {
			DomUtil.toFront(this._container);
			this._setAutoZIndex(Math.max);
		}
		return this;
	},

	// @method bringToBack: this
	// 将瓦片层置于所有瓦片层的底部。
	bringToBack: function () {
		if (this._map) {
			DomUtil.toBack(this._container);
			this._setAutoZIndex(Math.min);
		}
		return this;
	},

	// @method getContainer: HTMLElement
	// 返回包含该层瓦片的HTML元素。
	getContainer: function () {
		return this._container;
	},

	// @method setOpacity(opacity: Number): this
	// 更改网格层的[opacity](#gridlayer-opacity)。
	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	// @method setZIndex(zIndex: Number): this
	// 更改网格层的[zIndex](#gridlayer-zindex)。
	setZIndex: function (zIndex) {
		this.options.zIndex = zIndex;
		this._updateZIndex();

		return this;
	},

	// @method isLoading: Boolean
	// 如果网格层中的任何瓦片尚未加载完成，则返回`true`。
	isLoading: function () {
		return this._loading;
	},

	// @method redraw: this
	// 使该层清除所有瓦片并重新请求加载。
	redraw: function () {
		if (this._map) {
			this._removeAllTiles();
			var tileZoom = this._clampZoom(this._map.getZoom());
			if (tileZoom !== this._tileZoom) {
				this._tileZoom = tileZoom;
				this._updateLevels();
			}
			this._update();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			viewprereset: this._invalidateAll,
			viewreset: this._resetView,
			zoom: this._resetView,
			moveend: this._onMoveEnd
		};

		if (!this.options.updateWhenIdle) {
			// 在移动时更新瓦片，但频率不能超过给定间隔一次。
			if (!this._onMove) {
				this._onMove = Util.throttle(this._onMoveEnd, this.options.updateInterval, this);
			}

			events.move = this._onMove;
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	// @section Extension methods
	// 扩展`GridLayer`的层必须实现以下方法。
	// @method createTile(coords: Object, done?: Function): HTMLElement
	// 仅内部调用，由扩展`GridLayer`的类覆盖。
	// 返回与给定`coords`对应的`HTMLElement`。如果指定了`done`回调，
	// 则必须在瓦片完成加载和绘制时调用。
	createTile: function () {
		return document.createElement('div');
	},

	// @section
	// @method getTileSize: Point
	// 将[tileSize选项](#gridlayer-tilesize)转换为点单位，由`createTile()`方法使用。
	getTileSize: function () {
		var s = this.options.tileSize;
		return s instanceof Point ? s : new Point(s, s);
	},

	_updateZIndex: function () {
		if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._container.style.zIndex = this.options.zIndex;
		}
	},

	_setAutoZIndex: function (compare) {
		// 遍历同一面板中的所有其他层，将zIndex设置为max + 1（最前）或min - 1（最后）。

		var layers = this.getPane().children,
		    edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

		for (var i = 0, len = layers.length, zIndex; i < len; i++) {

			zIndex = layers[i].style.zIndex;

			if (layers[i] !== this._container && zIndex) {
				edgeZIndex = compare(edgeZIndex, +zIndex);
			}
		}

		if (isFinite(edgeZIndex)) {
			this.options.zIndex = edgeZIndex + compare(-1, 1);
			this._updateZIndex();
		}
	},

	_updateOpacity: function () {
		if (!this._map) { return; }

		// IE无法正确继承滤镜不透明度，因此我们必须直接在瓦片上设置它。
		if (Browser.ielt9) { return; }

		DomUtil.setOpacity(this._container, this.options.opacity);

		var now = +new Date(),
		    nextFrame = false,
		    willPrune = false;

		for (var key in this._tiles) {
			var tile = this._tiles[key];
			if (!tile.current || !tile.loaded) { continue; }

			var fade = Math.min(1, (now - tile.loaded) / 200);

			DomUtil.setOpacity(tile.el, fade);
			if (fade < 1) {
				nextFrame = true;
			} else {
				if (tile.active) {
					willPrune = true;
				} else {
					this._onOpaqueTile(tile);
				}
				tile.active = true;
			}
		}

		if (willPrune && !this._noPrune) { this._pruneTiles(); }

		if (nextFrame) {
			Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = Util.requestAnimFrame(this._updateOpacity, this);
		}
	},

	_onOpaqueTile: Util.falseFn,

	_initContainer: function () {
		if (this._container) { return; }

		this._container = DomUtil.create('div', 'leaflet-layer ' + (this.options.className || ''));
		this._updateZIndex();

		if (this.options.opacity < 1) {
			this._updateOpacity();
		}

		this.getPane().appendChild(this._container);
	},

	_updateLevels: function () {

		var zoom = this._tileZoom,
		    maxZoom = this.options.maxZoom;

		if (zoom === undefined) { return undefined; }

		for (var z in this._levels) {
			z = Number(z);
			if (this._levels[z].el.children.length || z === zoom) {
				this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
				this._onUpdateLevel(z);
			} else {
				DomUtil.remove(this._levels[z].el);
				this._removeTilesAtZoom(z);
				this._onRemoveLevel(z);
				delete this._levels[z];
			}
		}

		var level = this._levels[zoom],
		    map = this._map;

		if (!level) {
			level = this._levels[zoom] = {};

			level.el = DomUtil.create('div', 'leaflet-tile-container leaflet-zoom-animated', this._container);
			level.el.style.zIndex = maxZoom;

			level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
			level.zoom = zoom;

			this._setZoomTransform(level, map.getCenter(), map.getZoom());

			// 强制浏览器考虑新添加的元素用于过渡效果。
			Util.falseFn(level.el.offsetWidth);

			this._onCreateLevel(level);
		}

		this._level = level;

		return level;
	},

	_onUpdateLevel: Util.falseFn,

	_onRemoveLevel: Util.falseFn,

	_onCreateLevel: Util.falseFn,

	_pruneTiles: function () {
		if (!this._map) {
			return;
		}

		var key, tile;

		var zoom = this._map.getZoom();
		if (zoom > this.options.maxZoom ||
			zoom < this.options.minZoom) {
			this._removeAllTiles();
			return;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			tile.retain = tile.current;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			if (tile.current && !tile.active) {
				var coords = tile.coords;
				if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
					this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
				}
			}
		}

		for (key in this._tiles) {
			if (!this._tiles[key].retain) {
				this._removeTile(key);
			}
		}
	},

	_removeTilesAtZoom: function (zoom) {
		for (var key in this._tiles) {
			if (this._tiles[key].coords.z !== zoom) {
				continue;
			}
			this._removeTile(key);
		}
	},

	_removeAllTiles: function () {
		for (var key in this._tiles) {
			this._removeTile(key);
		}
	},

	_invalidateAll: function () {
		for (var z in this._levels) {
			DomUtil.remove(this._levels[z].el);
			this._onRemoveLevel(Number(z));
			delete this._levels[z];
		}
		this._removeAllTiles();

		this._tileZoom = undefined;
	},

	_retainParent: function (x, y, z, minZoom) {
		var x2 = Math.floor(x / 2),
		    y2 = Math.floor(y / 2),
		    z2 = z - 1,
		    coords2 = new Point(+x2, +y2);
		coords2.z = +z2;

		var key = this._tileCoordsToKey(coords2),
		    tile = this._tiles[key];

		if (tile && tile.active) {
			tile.retain = true;
			return true;

		} else if (tile && tile.loaded) {
			tile.retain = true;
		}

		if (z2 > minZoom) {
			return this._retainParent(x2, y2, z2, minZoom);
		}

		return false;
	},

	_retainChildren: function (x, y, z, maxZoom) {

		for (var i = 2 * x; i < 2 * x + 2; i++) {
			for (var j = 2 * y; j < 2 * y + 2; j++) {

				var coords = new Point(i, j);
				coords.z = z + 1;

				var key = this._tileCoordsToKey(coords),
				    tile = this._tiles[key];

				if (tile && tile.active) {
					tile.retain = true;
					continue;

				} else if (tile && tile.loaded) {
					tile.retain = true;
				}

				if (z + 1 < maxZoom) {
					this._retainChildren(i, j, z + 1, maxZoom);
				}
			}
		}
	},

	_resetView: function (e) {
		var animating = e && (e.pinch || e.flyTo);
		this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
	},

	_animateZoom: function (e) {
		this._setView(e.center, e.zoom, true, e.noUpdate);
	},

	_clampZoom: function (zoom) {
		var options = this.options;

		if (undefined !== options.minNativeZoom && zoom < options.minNativeZoom) {
			return options.minNativeZoom;
		}

		if (undefined !== options.maxNativeZoom && options.maxNativeZoom < zoom) {
			return options.maxNativeZoom;
		}

		return zoom;
	},

	_setView: function (center, zoom, noPrune, noUpdate) {
		var tileZoom = Math.round(zoom);
		if ((this.options.maxZoom !== undefined && tileZoom > this.options.maxZoom) ||
		    (this.options.minZoom !== undefined && tileZoom < this.options.minZoom)) {
			tileZoom = undefined;
		} else {
			tileZoom = this._clampZoom(tileZoom);
		}

		var tileZoomChanged = this.options.updateWhenZooming && (tileZoom !== this._tileZoom);

		if (!noUpdate || tileZoomChanged) {

			this._tileZoom = tileZoom;

			if (this._abortLoading) {
				this._abortLoading();
			}

			this._updateLevels();
			this._resetGrid();

			if (tileZoom !== undefined) {
				this._update(center);
			}

			if (!noPrune) {
				this._pruneTiles();
			}

			// 标志用于防止`_updateOpacity`在
			// 缩放动画或捏合手势期间删除瓦片。
			this._noPrune = !!noPrune;
		}

		this._setZoomTransforms(center, zoom);
	},

	_setZoomTransforms: function (center, zoom) {
		for (var i in this._levels) {
			this._setZoomTransform(this._levels[i], center, zoom);
		}
	},

	_setZoomTransform: function (level, center, zoom) {
		var scale = this._map.getZoomScale(zoom, level.zoom),
		    translate = level.origin.multiplyBy(scale)
		        .subtract(this._map._getNewPixelOrigin(center, zoom)).round();

		if (Browser.any3d) {
			DomUtil.setTransform(level.el, translate, scale);
		} else {
			DomUtil.setPosition(level.el, translate);
		}
	},

	_resetGrid: function () {
		var map = this._map,
		    crs = map.options.crs,
		    tileSize = this._tileSize = this.getTileSize(),
		    tileZoom = this._tileZoom;

		var bounds = this._map.getPixelWorldBounds(this._tileZoom);
		if (bounds) {
			this._globalTileRange = this._pxBoundsToTileRange(bounds);
		}

		this._wrapX = crs.wrapLng && !this.options.noWrap && [
			Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
			Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y)
		];
		this._wrapY = crs.wrapLat && !this.options.noWrap && [
			Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
			Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y)
		];
	},

	_onMoveEnd: function () {
		if (!this._map || this._map._animatingZoom) { return; }

		this._update();
	},

	_getTiledPixelBounds: function (center) {
		var map = this._map,
		    mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom(),
		    scale = map.getZoomScale(mapZoom, this._tileZoom),
		    pixelCenter = map.project(center, this._tileZoom).floor(),
		    halfSize = map.getSize().divideBy(scale * 2);

		return new Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
	},

	// 根据地图边界加载网格当前缩放级别下的瓦片的私有方法。
	_update: function (center) {
		var map = this._map;
		if (!map) { return; }
		var zoom = this._clampZoom(map.getZoom());

		if (center === undefined) { center = map.getCenter(); }
		if (this._tileZoom === undefined) { return; }	// if out of minzoom/maxzoom

		var pixelBounds = this._getTiledPixelBounds(center),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    tileCenter = tileRange.getCenter(),
		    queue = [],
		    margin = this.options.keepBuffer,
		    noPruneRange = new Bounds(tileRange.getBottomLeft().subtract([margin, -margin]),
		                              tileRange.getTopRight().add([margin, -margin]));

		// 合理性检查：如果瓦片范围中某处包含Infinity，则触发恐慌。
		if (!(isFinite(tileRange.min.x) &&
		      isFinite(tileRange.min.y) &&
		      isFinite(tileRange.max.x) &&
		      isFinite(tileRange.max.y))) { throw new Error('Attempted to load an infinite number of tiles'); }

		for (var key in this._tiles) {
			var c = this._tiles[key].coords;
			if (c.z !== this._tileZoom || !noPruneRange.contains(new Point(c.x, c.y))) {
				this._tiles[key].current = false;
			}
		}

		// `_update`仅加载更多瓦片。如果瓦片缩放级别与地图的缩放级别差异过大，
		// 则让`_setView`重置层级并删除旧瓦片。
		if (Math.abs(zoom - this._tileZoom) > 1) { this._setView(center, zoom); return; }

		// 创建一个坐标队列以从...加载瓦片。
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				var coords = new Point(i, j);
				coords.z = this._tileZoom;

				if (!this._isValidTile(coords)) { continue; }

				var tile = this._tiles[this._tileCoordsToKey(coords)];
				if (tile) {
					tile.current = true;
				} else {
					queue.push(coords);
				}
			}
		}

		// 按距离中心的距离对瓦片队列进行排序，以便按顺序加载瓦片。
		queue.sort(function (a, b) {
			return a.distanceTo(tileCenter) - b.distanceTo(tileCenter);
		});

		if (queue.length !== 0) {
			// 如果这是第一批要加载的瓦片。
			if (!this._loading) {
				this._loading = true;
				// @event loading: Event
				// 当网格层开始加载瓦片时触发。
				this.fire('loading');
			}

			// 创建 DOM 片段以批量添加瓦片
			var fragment = document.createDocumentFragment();

			for (i = 0; i < queue.length; i++) {
				this._addTile(queue[i], fragment);
			}

			this._level.el.appendChild(fragment);
		}
	},

	_isValidTile: function (coords) {
		var crs = this._map.options.crs;

		if (!crs.infinite) {
			// 如果瓦片超出边界且未被包裹，则不要加载该瓦片
			var bounds = this._globalTileRange;
			if ((!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x)) ||
			    (!crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y))) { return false; }
		}

		if (!this.options.bounds) { return true; }

		// 如果瓦片没有与选项中的边界相交，则不要加载该瓦片
		var tileBounds = this._tileCoordsToBounds(coords);
		return latLngBounds(this.options.bounds).overlaps(tileBounds);
	},

	_keyToBounds: function (key) {
		return this._tileCoordsToBounds(this._keyToTileCoords(key));
	},

	_tileCoordsToNwSe: function (coords) {
		var map = this._map,
		    tileSize = this.getTileSize(),
		    nwPoint = coords.scaleBy(tileSize),
		    sePoint = nwPoint.add(tileSize),
		    nw = map.unproject(nwPoint, coords.z),
		    se = map.unproject(sePoint, coords.z);
		return [nw, se];
	},

	// 将瓦片坐标转换为其地理边界
	_tileCoordsToBounds: function (coords) {
		var bp = this._tileCoordsToNwSe(coords),
		    bounds = new LatLngBounds(bp[0], bp[1]);

		if (!this.options.noWrap) {
			bounds = this._map.wrapLatLngBounds(bounds);
		}
		return bounds;
	},
	// 将瓦片坐标转换为瓦片缓存的键
	_tileCoordsToKey: function (coords) {
		return coords.x + ':' + coords.y + ':' + coords.z;
	},

	// 将瓦片缓存键转换为坐标
	_keyToTileCoords: function (key) {
		var k = key.split(':'),
		    coords = new Point(+k[0], +k[1]);
		coords.z = +k[2];
		return coords;
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

		DomUtil.remove(tile.el);

		delete this._tiles[key];

		// @event tileunload: TileEvent
		// 当瓦片被移除时触发（例如，当瓦片离开屏幕时）
		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	},

	_initTile: function (tile) {
		DomUtil.addClass(tile, 'leaflet-tile');

		var tileSize = this.getTileSize();
		tile.style.width = tileSize.x + 'px';
		tile.style.height = tileSize.y + 'px';

		tile.onselectstart = Util.falseFn;
		tile.onmousemove = Util.falseFn;

		// 由于滤镜继承问题，在 IE7-8 中需要更新瓦片的透明度
		if (Browser.ielt9 && this.options.opacity < 1) {
			DomUtil.setOpacity(tile, this.options.opacity);
		}
	},

	_addTile: function (coords, container) {
		var tilePos = this._getTilePos(coords),
		    key = this._tileCoordsToKey(coords);

		var tile = this.createTile(this._wrapCoords(coords), Util.bind(this._tileReady, this, coords));

		this._initTile(tile);

		// 如果 `createTile` 定义了第二个参数（“完成”回调），
		// 我们知道该瓦片是异步的，将在稍后准备好；否则
		if (this.createTile.length < 2) {
			// 将瓦片标记为已准备就绪，但延迟一帧以进行透明度动画效果
			Util.requestAnimFrame(Util.bind(this._tileReady, this, coords, null, tile));
		}

		DomUtil.setPosition(tile, tilePos);

		// 将瓦片保存到缓存中
		this._tiles[key] = {
			el: tile,
			coords: coords,
			current: true
		};

		container.appendChild(tile);
		// @event tileloadstart: TileEvent
		// 当请求并开始加载瓦片时触发
		this.fire('tileloadstart', {
			tile: tile,
			coords: coords
		});
	},

	_tileReady: function (coords, err, tile) {
		if (err) {
			// @event tileerror: TileErrorEvent
			// 当加载瓦片出现错误时触发
			this.fire('tileerror', {
				error: err,
				tile: tile,
				coords: coords
			});
		}

		var key = this._tileCoordsToKey(coords);

		tile = this._tiles[key];
		if (!tile) { return; }

		tile.loaded = +new Date();
		if (this._map._fadeAnimated) {
			DomUtil.setOpacity(tile.el, 0);
			Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = Util.requestAnimFrame(this._updateOpacity, this);
		} else {
			tile.active = true;
			this._pruneTiles();
		}

		if (!err) {
			DomUtil.addClass(tile.el, 'leaflet-tile-loaded');

			// @event tileload: TileEvent
			// 当瓦片加载完成时触发
			this.fire('tileload', {
				tile: tile.el,
				coords: coords
			});
		}

		if (this._noTilesToLoad()) {
			this._loading = false;
			// @event load: Event
			// 当网格层加载所有可见瓦片时触发
			this.fire('load');

			if (Browser.ielt9 || !this._map._fadeAnimated) {
				Util.requestAnimFrame(this._pruneTiles, this);
			} else {
				// 等待超过 0.2 秒（瓦片淡入的持续时间）以触发修剪操作
				// 以触发剪枝
				setTimeout(Util.bind(this._pruneTiles, this), 250);
			}
		}
	},

	_getTilePos: function (coords) {
		return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
	},

	_wrapCoords: function (coords) {
		var newCoords = new Point(
			this._wrapX ? Util.wrapNum(coords.x, this._wrapX) : coords.x,
			this._wrapY ? Util.wrapNum(coords.y, this._wrapY) : coords.y);
		newCoords.z = coords.z;
		return newCoords;
	},

	_pxBoundsToTileRange: function (bounds) {
		var tileSize = this.getTileSize();
		return new Bounds(
			bounds.min.unscaleBy(tileSize).floor(),
			bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1]));
	},

	_noTilesToLoad: function () {
		for (var key in this._tiles) {
			if (!this._tiles[key].loaded) { return false; }
		}
		return true;
	}
});

// @factory L.gridLayer(options?: GridLayer options)
// 根据提供的选项，创建新的 GridLayer 实例
export function gridLayer(options) {
	return new GridLayer(options);
}
