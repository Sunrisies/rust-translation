import {Path} from './Path';
import * as Util from '../../core/Util';
import * as LineUtil from '../../geometry/LineUtil';
import {LatLng, toLatLng} from '../../geo/LatLng';
import {LatLngBounds} from '../../geo/LatLngBounds';
import {Bounds} from '../../geometry/Bounds';
import {Point} from '../../geometry/Point';

/*
 * @class Polyline
 * @aka L.Polyline
 * @inherits Path
 *
 * 用于在地图上绘制折线覆盖层的类。继承 `Path` 类。
 *
 * @example
 *
 * ```js
 * // create a red polyline from an array of LatLng points
 * var latlngs = [
 * 	[45.51, -122.68],
 * 	[37.77, -122.43],
 * 	[34.04, -118.2]
 * ];
 *
 * var polyline = L.polyline(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polyline
 * map.fitBounds(polyline.getBounds());
 * ```
 *
 * You can also pass a multi-dimensional array to represent a `MultiPolyline` shape:
 *
 * ```js
 * // create a red polyline from an array of arrays of LatLng points
 * var latlngs = [
 * 	[[45.51, -122.68],
 * 	 [37.77, -122.43],
 * 	 [34.04, -118.2]],
 * 	[[40.78, -73.91],
 * 	 [41.83, -87.62],
 * 	 [32.76, -96.72]]
 * ];
 * ```
 */


export var Polyline = Path.extend({

	// @section
	// @aka Polyline options
	options: {
		// @option smoothFactor: Number = 1.0
		// 在每个缩放级别下，折线应简化的程度。值越大表示
		// 性能更好、外观更平滑；值越小则表示表现更精确。
		smoothFactor: 1.0,

		// @option noClip: Boolean = false
		// 禁用折线的裁剪功能。
		noClip: false
	},

	initialize: function (latlngs, options) {
		Util.setOptions(this, options);
		this._setLatLngs(latlngs);
	},

	// @method getLatLngs(): LatLng[]
	// 返回路径中的点数组，若为多折线则返回嵌套的点数组。
	getLatLngs: function () {
		return this._latlngs;
	},

	// @method setLatLngs(latlngs: LatLng[]): this
	// 用给定的地理点数组替换折线中的所有点。
	setLatLngs: function (latlngs) {
		this._setLatLngs(latlngs);
		return this.redraw();
	},

	// @method isEmpty(): Boolean
	// 如果折线没有 LatLng 坐标，则返回 `true`。
	isEmpty: function () {
		return !this._latlngs.length;
	},

	// @method closestLayerPoint(p: Point): Point
	// 返回折线上最接近 `p` 的点。
	closestLayerPoint: function (p) {
		var minDistance = Infinity,
		    minPoint = null,
		    closest = LineUtil._sqClosestPointOnSegment,
		    p1, p2;

		for (var j = 0, jLen = this._parts.length; j < jLen; j++) {
			var points = this._parts[j];

			for (var i = 1, len = points.length; i < len; i++) {
				p1 = points[i - 1];
				p2 = points[i];

				var sqDist = closest(p, p1, p2, true);

				if (sqDist < minDistance) {
					minDistance = sqDist;
					minPoint = closest(p, p1, p2);
				}
			}
		}
		if (minPoint) {
			minPoint.distance = Math.sqrt(minDistance);
		}
		return minPoint;
	},

	// @method getCenter(): LatLng
	// 返回折线的中心（[质心](https://en.wikipedia.org/wiki/Centroid)）。
	getCenter: function () {
		// 当尚未添加到地图时抛出错误，因为计算质心需要投影坐标。
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}
		return LineUtil.polylineCenter(this._defaultShape(), this._map.options.crs);
	},

	// @method getBounds(): LatLngBounds
	// 返回路径的 `LatLngBounds`。
	getBounds: function () {
		return this._bounds;
	},

	// @method addLatLng(latlng: LatLng, latlngs?: LatLng[]): this
	// 将给定点添加到折线中。默认情况下，添加到折线的第一环；
	// 若为多折线，则通过传递特定环的 LatLng 数组来覆盖此行为（可通过 [`getLatLngs`](#折线-getlatlngs) 提前获取）。
	// 递归地将 LatLng 输入转换为实际的 LatLng 实例，并沿途计算边界。
	addLatLng: function (latlng, latlngs) {
		latlngs = latlngs || this._defaultShape();
		latlng = toLatLng(latlng);
		latlngs.push(latlng);
		this._bounds.extend(latlng);
		return this.redraw();
	},

	_setLatLngs: function (latlngs) {
		this._bounds = new LatLngBounds();
		this._latlngs = this._convertLatLngs(latlngs);
	},

	_defaultShape: function () {
		return LineUtil.isFlat(this._latlngs) ? this._latlngs : this._latlngs[0];
	},

	// 递归地将 LatLng 转换为带有投影坐标的环集合。
	_convertLatLngs: function (latlngs) {
		var result = [],
		    flat = LineUtil.isFlat(latlngs);

		for (var i = 0, len = latlngs.length; i < len; i++) {
			if (flat) {
				result[i] = toLatLng(latlngs[i]);
				this._bounds.extend(result[i]);
			} else {
				result[i] = this._convertLatLngs(latlngs[i]);
			}
		}

		return result;
	},

	_project: function () {
		var pxBounds = new Bounds();
		this._rings = [];
		this._projectLatlngs(this._latlngs, this._rings, pxBounds);

		if (this._bounds.isValid() && pxBounds.isValid()) {
			this._rawPxBounds = pxBounds;
			this._updateBounds();
		}
	},

	_updateBounds: function () {
		var w = this._clickTolerance(),
		    p = new Point(w, w);

		if (!this._rawPxBounds) {
			return;
		}

		this._pxBounds = new Bounds([
			this._rawPxBounds.min.subtract(p),
			this._rawPxBounds.max.add(p)
		]);
	},

	// recursively turns latlngs into a set of rings with projected coordinates
	_projectLatlngs: function (latlngs, result, projectedBounds) {
		var flat = latlngs[0] instanceof LatLng,
		    len = latlngs.length,
		    i, ring;

		if (flat) {
			ring = [];
			for (i = 0; i < len; i++) {
				ring[i] = this._map.latLngToLayerPoint(latlngs[i]);
				projectedBounds.extend(ring[i]);
			}
			result.push(ring);
		} else {
			for (i = 0; i < len; i++) {
				this._projectLatlngs(latlngs[i], result, projectedBounds);
			}
		}
	},

	// 通过渲染器边界裁剪折线，以减少需要渲染的点数以提升性能。
	_clipPoints: function () {
		var bounds = this._renderer._bounds;

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		var parts = this._parts,
		    i, j, k, len, len2, segment, points;

		for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
			points = this._rings[i];

			for (j = 0, len2 = points.length; j < len2 - 1; j++) {
				segment = LineUtil.clipSegment(points[j], points[j + 1], bounds, j, true);

				if (!segment) { continue; }

				parts[k] = parts[k] || [];
				parts[k].push(segment[0]);

				// 如果线段超出屏幕或作为最后一段，则视为线条的末端部分。
				if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
					parts[k].push(segment[1]);
					k++;
				}
			}
		}
	},

	// 为提升性能，对被裁剪的折线部分进行简化。
	_simplifyPoints: function () {
		var parts = this._parts,
		    tolerance = this.options.smoothFactor;

		for (var i = 0, len = parts.length; i < len; i++) {
			parts[i] = LineUtil.simplify(parts[i], tolerance);
		}
	},

	_update: function () {
		if (!this._map) { return; }

		this._clipPoints();
		this._simplifyPoints();
		this._updatePath();
	},

	_updatePath: function () {
		this._renderer._updatePoly(this);
	},

	// `Canvas` 渲染器需要此功能以实现交互性。
	_containsPoint: function (p, closed) {
		var i, j, k, len, len2, part,
		    w = this._clickTolerance();

		if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

		// 折线的碰撞检测。
		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				if (!closed && (j === 0)) { continue; }

				if (LineUtil.pointToSegmentDistance(p, part[k], part[j]) <= w) {
					return true;
				}
			}
		}
		return false;
	}
});

// @factory L.polyline(latlngs: LatLng[], options?: Polyline options)
// 根据地理点数组及可选选项对象实例化折线对象。可通过传递多个地理点数组来创建 `Polyline` 对象。
// optionally an options object. You can create a `Polyline` object with
// 通过传递地理点数组的数组形式，可创建多条独立线段（`MultiPolyline`）。
// 
export function polyline(latlngs, options) {
	return new Polyline(latlngs, options);
}

// 向后兼容，允许插件支持 1.1 之前和之后的 Leaflet 版本。
Polyline._flat = LineUtil._flat;
