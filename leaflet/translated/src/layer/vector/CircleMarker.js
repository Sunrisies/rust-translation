import {Path} from './Path';
import * as Util from '../../core/Util';
import {toLatLng} from '../../geo/LatLng';
import {Bounds} from '../../geometry/Bounds';


/*
 * @class CircleMarker
 * @aka L.CircleMarker
 * @inherits Path
 *
 * 一个固定大小的圆形，其半径以像素为单位。属于 `Path` 类型。
 */

export var CircleMarker = Path.extend({

	// @section
	// @aka CircleMarker options
	options: {
		fill: true,

		// @option radius: Number = 10
		// 圆形标记的半径，单位：像素
		radius: 10
	},

	initialize: function (latlng, options) {
		Util.setOptions(this, options);
		this._latlng = toLatLng(latlng);
		this._radius = this.options.radius;
	},

	// @method setLatLng(latLng: LatLng): this
	// 将圆形标记的位置移动到新位置。
	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = toLatLng(latlng);
		this.redraw();

		// @event move: Event
		// 当通过 [`setLatLng`](#circlemarker-setlatlng) 移动标记时触发此事件。旧坐标和新坐标作为 `oldLatLng`、`latlng` 包含在事件参数中。
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	// @method getLatLng(): LatLng
	// 返回圆形标记的当前地理位置
	getLatLng: function () {
		return this._latlng;
	},

	// @method setRadius(radius: Number): this
	// 设置圆形标记的半径。单位：像素。
	setRadius: function (radius) {
		this.options.radius = this._radius = radius;
		return this.redraw();
	},

	// @method getRadius(): Number
	// 返回圆形的当前半径
	getRadius: function () {
		return this._radius;
	},

	setStyle : function (options) {
		var radius = options && options.radius || this._radius;
		Path.prototype.setStyle.call(this, options);
		this.setRadius(radius);
		return this;
	},

	_project: function () {
		this._point = this._map.latLngToLayerPoint(this._latlng);
		this._updateBounds();
	},

	_updateBounds: function () {
		var r = this._radius,
		    r2 = this._radiusY || r,
		    w = this._clickTolerance(),
		    p = [r + w, r2 + w];
		this._pxBounds = new Bounds(this._point.subtract(p), this._point.add(p));
	},

	_update: function () {
		if (this._map) {
			this._updatePath();
		}
	},

	_updatePath: function () {
		this._renderer._updateCircle(this);
	},

	_empty: function () {
		return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
	},

	// `Canvas` 渲染器需要此功能以实现交互性
	_containsPoint: function (p) {
		return p.distanceTo(this._point) <= this._radius + this._clickTolerance();
	}
});


// @factory L.circleMarker(latlng: LatLng, options?: CircleMarker options)
// 根据地理点及可选选项对象实例化一个圆形标记对象
export function circleMarker(latlng, options) {
	return new CircleMarker(latlng, options);
}
