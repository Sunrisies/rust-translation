import * as LineUtil from './LineUtil';
import {toLatLng} from '../geo/LatLng';
import {toPoint} from './Point';
import {toLatLngBounds} from '../geo/LatLngBounds';
/*
 * @namespace PolyUtil
 * 用于多边形几何的各种实用函数。
 */

/* @function clipPolygon(points: Point[], bounds: Bounds, round?: Boolean): Point[]
 * 使用[Sutherland-Hodgman算法](https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm)将给定`points`定义的多边形几何裁剪至指定边界内。
 * Leaflet 使用此功能仅显示屏幕上或附近的多边形点，从而提高性能。注意，多边形点的裁剪算法与多线不同，因此有单独的方法处理。
 * performance. Note that 多边形 points needs different algorithm for clipping
 * than 折线, so there's a separate method for it.
 */
export function clipPolygon(points, bounds, round) {
	var clippedPoints,
	    edges = [1, 4, 2, 8],
	    i, j, k,
	    a, b,
	    len, edge, p;

	for (i = 0, len = points.length; i < len; i++) {
		points[i]._code = LineUtil._getBitCode(points[i], bounds);
	}

	// 针对每条边（左、下、右、上）：
	for (k = 0; k < 4; k++) {
		edge = edges[k];
		clippedPoints = [];

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			a = points[i];
			b = points[j];

			// 如果 a 在裁剪窗口内：
			if (!(a._code & edge)) {
				// 如果 b 在裁剪窗口外（a->b 超出屏幕范围）：
				if (b._code & edge) {
					p = LineUtil._getEdgeIntersection(b, a, edge, bounds, round);
					p._code = LineUtil._getBitCode(p, bounds);
					clippedPoints.push(p);
				}
				clippedPoints.push(a);

			// 否则如果 b 在裁剪窗口内（a->b 进入屏幕范围）：
			} else if (!(b._code & edge)) {
				p = LineUtil._getEdgeIntersection(b, a, edge, bounds, round);
				p._code = LineUtil._getBitCode(p, bounds);
				clippedPoints.push(p);
			}
		}
		points = clippedPoints;
	}

	return points;
}

/* @function polygonCenter(latlngs: LatLng[], crs: CRS): LatLng
 * 返回多边形经过的 LatLngs（第一环）的中心点（[质心](http://en.wikipedia.org/wiki/Centroid)）。
 */
export function polygonCenter(latlngs, crs) {
	var i, j, p1, p2, f, area, x, y, center;

	if (!latlngs || latlngs.length === 0) {
		throw new Error('latlngs not passed');
	}

	if (!LineUtil.isFlat(latlngs)) {
		console.warn('latlngs are not flat! Only the first ring will be used');
		latlngs = latlngs[0];
	}

	var centroidLatLng = toLatLng([0, 0]);

	var bounds = toLatLngBounds(latlngs);
	var areaBounds = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) * bounds.getNorthEast().distanceTo(bounds.getNorthWest());
	// 测试表明，当数值低于1700时会出现舍入误差。
	if (areaBounds < 1700) {
		// 导致无法得到精确的中心点，因此将 LatLngs 移动到[0, 0]附近以预防舍入误差。
		centroidLatLng = centroid(latlngs);
	}

	var len = latlngs.length;
	var points = [];
	for (i = 0; i < len; i++) {
		var latlng = toLatLng(latlngs[i]);
		points.push(crs.project(toLatLng([latlng.lat - centroidLatLng.lat, latlng.lng - centroidLatLng.lng])));
	}

	area = x = y = 0;

	// 多边形质心算法；
	for (i = 0, j = len - 1; i < len; j = i++) {
		p1 = points[i];
		p2 = points[j];

		f = p1.y * p2.x - p2.y * p1.x;
		x += (p1.x + p2.x) * f;
		y += (p1.y + p2.y) * f;
		area += f * 3;
	}

	if (area === 0) {
		// 多边形非常小，所有点都位于同一像素上。
		center = points[0];
	} else {
		center = [x / area, y / area];
	}

	var latlngCenter = crs.unproject(toPoint(center));
	return toLatLng([latlngCenter.lat + centroidLatLng.lat, latlngCenter.lng + centroidLatLng.lng]);
}

/* @function centroid(latlngs: LatLng[]): LatLng
 * 返回传入的 LatLngs 的“质心”。
 */
export function centroid(coords) {
	var latSum = 0;
	var lngSum = 0;
	var len = 0;
	for (var i = 0; i < coords.length; i++) {
		var latlng = toLatLng(coords[i]);
		latSum += latlng.lat;
		lngSum += latlng.lng;
		len++;
	}
	return toLatLng([latSum / len, lngSum / len]);
}
