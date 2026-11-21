import {Point, toPoint} from './Point';
import * as Util from '../core/Util';
import {toLatLng} from '../geo/LatLng';
import {centroid} from './PolyUtil';
import {toLatLngBounds} from '../geo/LatLngBounds';


/*
 * @namespace LineUtil
 *
 * 各种用于多线点处理的实用函数，由 Leaflet 内部使用以使多线渲染速度极快。
 */

// 通过顶点简化和 Douglas-Peucker 简化技术对多线进行简化处理。
// 通过减少绘制点数，显著提升渲染性能。

// @function simplify(points: Point[], tolerance: Number): Point[]
// 大幅减少多线中的点数，同时保留其形状，并返回一个新的简化点数组。
// 用于在处理/显示 Leaflet 多线时获得巨大性能提升，也减少了视觉噪声。容差影响简化的程度（数值越小意味着质量越高，但速度越慢且点数越多）。
// [Ramer-Douglas-Peucker algorithm](https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm).
// 作为独立的微库 [Simplify.js](https://mourner.github.io/simplify-js/) 发布。
// each zoom level and also reducing visual noise. tolerance affects the amount of
// simplification (lesser value means higher quality but slower and with more points).
// Also released as a separated micro-library [Simplify.js](https://mourner.github.io/simplify-js/).
export function simplify(points, tolerance) {
	if (!tolerance || !points.length) {
		return points.slice();
	}

	var sqTolerance = tolerance * tolerance;

	    // 阶段 1：顶点简化
	    points = _reducePoints(points, sqTolerance);

	    // 阶段 2：Douglas-Peucker 简化
	    points = _simplifyDP(points, sqTolerance);

	return points;
}

// @function pointToSegmentDistance(p: Point, p1: Point, p2: Point): Number
// 返回点 `p` 与线段 `p1` 到 `p2` 之间的距离。
export function pointToSegmentDistance(p, p1, p2) {
	return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
}

// @function closestPointOnSegment(p: Point, p1: Point, p2: Point): Number
// 返回线段 `p1` 上点 `p` 到 `p2` 的最近点。
export function closestPointOnSegment(p, p1, p2) {
	return _sqClosestPointOnSegment(p, p1, p2);
}

// Ramer-Douglas-Peucker 简化算法，参见 https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm
function _simplifyDP(points, sqTolerance) {

	var len = points.length,
	    ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
	    markers = new ArrayConstructor(len);

	    markers[0] = markers[len - 1] = 1;

	_simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

	var i,
	    newPoints = [];

	for (i = 0; i < len; i++) {
		if (markers[i]) {
			newPoints.push(points[i]);
		}
	}

	return newPoints;
}

function _simplifyDPStep(points, markers, sqTolerance, first, last) {

	var maxSqDist = 0,
	index, i, sqDist;

	for (i = first + 1; i <= last - 1; i++) {
		sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);

		if (sqDist > maxSqDist) {
			index = i;
			maxSqDist = sqDist;
		}
	}

	if (maxSqDist > sqTolerance) {
		markers[index] = 1;

		_simplifyDPStep(points, markers, sqTolerance, first, index);
		_simplifyDPStep(points, markers, sqTolerance, index, last);
	}
}

// 将彼此过于接近的点简化为单个点。
function _reducePoints(points, sqTolerance) {
	var reducedPoints = [points[0]];

	for (var i = 1, prev = 0, len = points.length; i < len; i++) {
		if (_sqDist(points[i], points[prev]) > sqTolerance) {
			reducedPoints.push(points[i]);
			prev = i;
		}
	}
	if (prev < len - 1) {
		reducedPoints.push(points[len - 1]);
	}
	return reducedPoints;
}

var _lastCode;

// @function clipSegment(a: Point, b: Point, bounds: Bounds, useLastCode?: Boolean, round?: Boolean): Point[]|Boolean
// 通过矩形边界裁剪线段 a 到 b，
// [Cohen-Sutherland algorithm](https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm)
// （直接修改线段上的点！）由 Leaflet 使用，仅显示屏幕上或附近的多线点，从而提高性能。
// points that are on the screen or near, increasing performance.
export function clipSegment(a, b, bounds, useLastCode, round) {
	var codeA = useLastCode ? _lastCode : _getBitCode(a, bounds),
	    codeB = _getBitCode(b, bounds),

	    codeOut, p, newCode;

	    // 保存第二个代码以避免在下一个线段上计算它。
	    _lastCode = codeB;

	while (true) {
		// 如果 a、b 在裁剪窗口内（简单接受）
		if (!(codeA | codeB)) {
			return [a, b];
		}

		// 如果 a、b 在裁剪窗口外（简单拒绝）
		if (codeA & codeB) {
			return false;
		}

		// 其他情况
		codeOut = codeA || codeB;
		p = _getEdgeIntersection(a, b, codeOut, bounds, round);
		newCode = _getBitCode(p, bounds);

		if (codeOut === codeA) {
			a = p;
			codeA = newCode;
		} else {
			b = p;
			codeB = newCode;
		}
	}
}

export function _getEdgeIntersection(a, b, code, bounds, round) {
	var dx = b.x - a.x,
	    dy = b.y - a.y,
	    min = bounds.min,
	    max = bounds.max,
	    x, y;

	if (code & 8) { // top
		x = a.x + dx * (max.y - a.y) / dy;
		y = max.y;

	} else if (code & 4) { // bottom
		x = a.x + dx * (min.y - a.y) / dy;
		y = min.y;

	} else if (code & 2) { // right
		x = max.x;
		y = a.y + dy * (max.x - a.x) / dx;

	} else if (code & 1) { // left
		x = min.x;
		y = a.y + dy * (min.x - a.x) / dx;
	}

	return new Point(x, y, round);
}

export function _getBitCode(p, bounds) {
	var code = 0;

	if (p.x < bounds.min.x) { // left
		code |= 1;
	} else if (p.x > bounds.max.x) { // right
		code |= 2;
	}

	if (p.y < bounds.min.y) { // bottom
		code |= 4;
	} else if (p.y > bounds.max.y) { // top
		code |= 8;
	}

	return code;
}

// 使用平方距离（避免不必要的 Math.sqrt 调用）
function _sqDist(p1, p2) {
	var dx = p2.x - p1.x,
	    dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}

// return closest point on segment or distance to that point
export function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
	var x = p1.x,
	    y = p1.y,
	    dx = p2.x - x,
	    dy = p2.y - y,
	    dot = dx * dx + dy * dy,
	    t;

	if (dot > 0) {
		t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

		if (t > 1) {
			x = p2.x;
			y = p2.y;
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}

	dx = p.x - x;
	dy = p.y - y;

	return sqDist ? dx * dx + dy * dy : new Point(x, y);
}


// @function isFlat(latlngs: LatLng[]): Boolean
// 如果 `latlngs` 是一个扁平数组则返回 true，如果是嵌套结构则返回 false。
export function isFlat(latlngs) {
	return !Util.isArray(latlngs[0]) || (typeof latlngs[0][0] !== 'object' && typeof latlngs[0][0] !== 'undefined');
}

export function _flat(latlngs) {
	console.warn('Deprecated use of _flat, please use L.LineUtil.isFlat instead.');
	return isFlat(latlngs);
}

/* @function polylineCenter(latlngs: LatLng[], crs: CRS): LatLng
 * 返回多线经过的 LatLngs（第一环）的中心点（[质心](http://en.wikipedia.org/wiki/Centroid)）。
 */
export function polylineCenter(latlngs, crs) {
	var i, halfDist, segDist, dist, p1, p2, ratio, center;

	if (!latlngs || latlngs.length === 0) {
		throw new Error('latlngs not passed');
	}

	if (!isFlat(latlngs)) {
		console.warn('latlngs are not flat! Only the first ring will be used');
		latlngs = latlngs[0];
	}

	var centroidLatLng = toLatLng([0, 0]);

	var bounds = toLatLngBounds(latlngs);
	var areaBounds = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) * bounds.getNorthEast().distanceTo(bounds.getNorthWest());
	// 测试表明，当数值低于 1700 时会出现舍入误差，
	if (areaBounds < 1700) {
		// 导致无法得到精确的中心位置，因此将 LatLngs 移动到 [0, 0] 附近以预防舍入误差。
		centroidLatLng = centroid(latlngs);
	}

	var len = latlngs.length;
	var points = [];
	for (i = 0; i < len; i++) {
		var latlng = toLatLng(latlngs[i]);
		points.push(crs.project(toLatLng([latlng.lat - centroidLatLng.lat, latlng.lng - centroidLatLng.lng])));
	}

	for (i = 0, halfDist = 0; i < len - 1; i++) {
		halfDist += points[i].distanceTo(points[i + 1]) / 2;
	}

	// 当前视图中的线段非常短，所有点都位于同一个像素上。
	if (halfDist === 0) {
		center = points[0];
	} else {
		for (i = 0, dist = 0; i < len - 1; i++) {
			p1 = points[i];
			p2 = points[i + 1];
			segDist = p1.distanceTo(p2);
			dist += segDist;

			if (dist > halfDist) {
				ratio = (dist - halfDist) / segDist;
				center = [
					p2.x - ratio * (p2.x - p1.x),
					p2.y - ratio * (p2.y - p1.y)
				];
				break;
			}
		}
	}

	var latlngCenter = crs.unproject(toPoint(center));
	return toLatLng([latlngCenter.lat + centroidLatLng.lat, latlngCenter.lng + centroidLatLng.lng]);
}
