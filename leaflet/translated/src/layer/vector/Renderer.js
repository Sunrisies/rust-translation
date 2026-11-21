import {Layer} from '../Layer';
import * as DomUtil from '../../dom/DomUtil';
import * as Util from '../../core/Util';
import Browser from '../../core/Browser';
import {Bounds} from '../../geometry/Bounds';



/*
 * @class Renderer
 * @inherits Layer
 * @aka L.Renderer
 *
 * 向量渲染器实现的基础类（`SVG`、`Canvas`）。负责处理渲染器的
 * DOM 容器、其边界以及缩放动画。
 *
 * `Renderer` 作为所有 `Path` 的隐含图层组——渲染器本身可以添加到地图中或从地图中移除。所有路径都使用渲染器，该渲染器可以是
 * 隐式的（地图会自动决定渲染器类型并使用它）或显式的（通过路径的 [`renderer`](#path-renderer) 选项）。
 * be implicit (the 地图 will decide the type of renderer and use it automatically)
 * or explicit (using the [`renderer`](#path-renderer) option of the path).
 *
 * 不要直接使用此类，应改用 `SVG` 和 `Canvas`。
 *
 * @event update: Event
 * 在渲染器更新其边界、中心和缩放时触发，例如当
 * 地图移动时。
 */

export var Renderer = Layer.extend({

	// @section
	// @aka Renderer options
	options: {
		// @option padding: Number = 0.1
		// 围绕地图视图扩展裁剪区域的程度（相对于其大小）
		// 例如，0.1表示每个方向为地图视图的 10%。
		padding: 0.1
	},

	initialize: function (options) {
		Util.setOptions(this, options);
		Util.stamp(this);
		this._layers = this._layers || {};
	},

	onAdd: function () {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations

			// 始终将 transform-origin 设置为 0 0。
			DomUtil.addClass(this._container, 'leaflet-zoom-animated');
		}

		this.getPane().appendChild(this._container);
		this._update();
		this.on('update', this._updatePaths, this);
	},

	onRemove: function () {
		this.off('update', this._updatePaths, this);
		this._destroyContainer();
	},

	getEvents: function () {
		var events = {
			viewreset: this._reset,
			zoom: this._onZoom,
			moveend: this._update,
			zoomend: this._onZoomEnd
		};
		if (this._zoomAnimated) {
			events.zoomanim = this._onAnimZoom;
		}
		return events;
	},

	_onAnimZoom: function (ev) {
		this._updateTransform(ev.center, ev.zoom);
	},

	_onZoom: function () {
		this._updateTransform(this._map.getCenter(), this._map.getZoom());
	},

	_updateTransform: function (center, zoom) {
		var scale = this._map.getZoomScale(zoom, this._zoom),
		    viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding),
		    currentCenterPoint = this._map.project(this._center, zoom),

		    topLeftOffset = viewHalf.multiplyBy(-scale).add(currentCenterPoint)
				  .subtract(this._map._getNewPixelOrigin(center, zoom));

		if (Browser.any3d) {
			DomUtil.setTransform(this._container, topLeftOffset, scale);
		} else {
			DomUtil.setPosition(this._container, topLeftOffset);
		}
	},

	_reset: function () {
		this._update();
		this._updateTransform(this._center, this._zoom);

		for (var id in this._layers) {
			this._layers[id]._reset();
		}
	},

	_onZoomEnd: function () {
		for (var id in this._layers) {
			this._layers[id]._project();
		}
	},

	_updatePaths: function () {
		for (var id in this._layers) {
			this._layers[id]._update();
		}
	},

	_update: function () {
		// 更新渲染器容器的像素边界（用于后续定位/尺寸/裁剪）
		// 子类负责触发 ‘update’ 事件。
		var p = this.options.padding,
		    size = this._map.getSize(),
		    min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());

		this._center = this._map.getCenter();
		this._zoom = this._map.getZoom();
	}
});
