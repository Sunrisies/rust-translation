import {Polyline} from './Polyline';
import {LatLng} from '../../geo/LatLng';
import * as LineUtil from '../../geometry/LineUtil';
import {Point} from '../../geometry/Point';
import {Bounds} from '../../geometry/Bounds';
import * as PolyUtil from '../../geometry/PolyUtil';

/*
 * @class Polygon
 * @aka L.Polygon
 * @inherits Polyline
 *
 * 一个用于在地图上绘制多边形覆盖层的类。继承 `Polyline` 类。
 *
 * 请注意，在创建多边形时传递的点不应有与第一个点相同的最后一个点——最好过滤掉这些点。
 *
 *
 * @example
 *
 * ```js
 * // create a red polygon from an array of LatLng points
 * var latlngs = [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]];
 *
 * var polygon = L.polygon(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polygon
 * map.fitBounds(polygon.getBounds());
 * ```
 *
 * You can also pass an array of arrays of latlngs, with the first array representing the outer shape and the other arrays representing holes in the outer shape:
 *
 * ```js
 * var latlngs = [
 *   [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *   [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 * ];
 * ```
 *
 * Additionally, you can pass a multi-dimensional array to represent a MultiPolygon shape.
 *
 * ```js
 * var latlngs = [
 *   [ // first polygon
 *     [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *     [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 *   ],
 *   [ // second polygon
 *     [[41, -111.03],[45, -111.04],[45, -104.05],[41, -104.05]]
 *   ]
 * ];
 * ```
 */

export var Polygon = Polyline.extend({

	options: {
		fill: true
	},

	isEmpty: function () {
		return !this._latlngs.length || !this._latlngs[0].length;
	},

	// @method getCenter(): LatLng
	// 返回多边形的中心点（[质心](http://en.wikipedia.org/wiki/Centroid)）。
	getCenter: function () {
		// 如果尚未添加到地图中，则抛出错误，因为计算中心点需要投影坐标。
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}
		return PolyUtil.polygonCenter(this._defaultShape(), this._map.options.crs);
	},

	_convertLatLngs: function (latlngs) {
		var result = Polyline.prototype._convertLatLngs.call(this, latlngs),
		    len = result.length;

		// 如果最后一个点与第一个点相同，则移除该点。
		if (len >= 2 && result[0] instanceof LatLng && result[0].equals(result[len - 1])) {
			result.pop();
		}
		return result;
	},

	_setLatLngs: function (latlngs) {
		Polyline.prototype._setLatLngs.call(this, latlngs);
		if (LineUtil.isFlat(this._latlngs)) {
			this._latlngs = [this._latlngs];
		}
	},

	_defaultShape: function () {
		return LineUtil.isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
	},

	_clipPoints: function () {
		// 多边形需要不同的裁剪算法，因此我们重新定义了该算法。

		var bounds = this._renderer._bounds,
		    w = this.options.weight,
		    p = new Point(w, w);

		// 将裁剪填充量增加为笔画宽度，以避免在裁剪边缘产生笔画。
		bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		for (var i = 0, len = this._rings.length, clipped; i < len; i++) {
			clipped = PolyUtil.clipPolygon(this._rings[i], bounds, true);
			if (clipped.length) {
				this._parts.push(clipped);
			}
		}
	},

	_updatePath: function () {
		this._renderer._updatePoly(this, true);
	},

	// `Canvas` 渲染器需要此功能以实现交互性。
	_containsPoint: function (p) {
		var inside = false,
		    part, p1, p2, i, j, k, len, len2;

		if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

		// 用于检测点是否在多边形内的射线投射算法。
		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				p1 = part[j];
				p2 = part[k];

				if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
					inside = !inside;
				}
			}
		}

		// 还要检查该点是否位于多边形的边界上。
		return inside || Polyline.prototype._containsPoint.call(this, p, true);
	}

});


// @factory L.polygon(latlngs: LatLng[], options?: Polyline options)
export function polygon(latlngs, options) {
	return new Polygon(latlngs, options);
}
