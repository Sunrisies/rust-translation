import {Point, toPoint} from './Point';

/*
 * @class Bounds
 * @aka L.Bounds
 *
 * 表示像素坐标下的矩形区域。
 *
 * @example
 *
 * ```js
 * var p1 = L.point(10, 10),
 * p2 = L.point(40, 60),
 * bounds = L.bounds(p1, p2);
 * ```
 *
 * All Leaflet methods that accept `Bounds` objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * otherBounds.intersects([[10, 10], [40, 60]]);
 * ```
 *
 * Note that `Bounds` does not inherit from Leaflet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

export function Bounds(a, b) {
	if (!a) { return; }

	var points = b ? [a, b] : a;

	for (var i = 0, len = points.length; i < len; i++) {
		this.extend(points[i]);
	}
}

Bounds.prototype = {
	// @method extend(point: Point): this
	// 扩展边界以包含给定点。

	// @alternative
	// @method extend(otherBounds: Bounds): this
	// 扩展边界以包含给定的边界范围。
	extend: function (obj) {
		var min2, max2;
		if (!obj) { return this; }

		if (obj instanceof Point || typeof obj[0] === 'number' || 'x' in obj) {
			min2 = max2 = toPoint(obj);
		} else {
			obj = toBounds(obj);
			min2 = obj.min;
			max2 = obj.max;

			if (!min2 || !max2) { return this; }
		}

		// @property min: Point
		// 矩形的左上角。
		// @property max: Point
		// 矩形的右下角。
		if (!this.min && !this.max) {
			this.min = min2.clone();
			this.max = max2.clone();
		} else {
			this.min.x = Math.min(min2.x, this.min.x);
			this.max.x = Math.max(max2.x, this.max.x);
			this.min.y = Math.min(min2.y, this.min.y);
			this.max.y = Math.max(max2.y, this.max.y);
		}
		return this;
	},

	// @method getCenter(round?: Boolean): Point
	// 返回边界的中心点。
	getCenter: function (round) {
		return toPoint(
		        (this.min.x + this.max.x) / 2,
		        (this.min.y + this.max.y) / 2, round);
	},

	// @method getBottomLeft(): Point
	// 返回边界的左下角点。
	getBottomLeft: function () {
		return toPoint(this.min.x, this.max.y);
	},

	// @method getTopRight(): Point
	// 返回边界的右上角点。
	getTopRight: function () { // -> Point
		return toPoint(this.max.x, this.min.y);
	},

	// @method getTopLeft(): Point
	// 返回边界的左上角点（即 [`this.min`](#边界-min））。
	getTopLeft: function () {
		return this.min; // left, top
	},

	// @method getBottomRight(): Point
	// 返回边界的右下角点（即 [`this.max`](#边界-max））。
	getBottomRight: function () {
		return this.max; // right, bottom
	},

	// @method getSize(): Point
	// 返回给定边界的大小。
	getSize: function () {
		return this.max.subtract(this.min);
	},

	// @method contains(otherBounds: Bounds): Boolean
	// 如果矩形包含给定边界，则返回 `true`。
	// @alternative
	// @method contains(point: Point): Boolean
	// 如果矩形包含给定点，则返回 `true`。
	contains: function (obj) {
		var min, max;

		if (typeof obj[0] === 'number' || obj instanceof Point) {
			obj = toPoint(obj);
		} else {
			obj = toBounds(obj);
		}

		if (obj instanceof Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	},

	// @method intersects(otherBounds: Bounds): Boolean
	// 如果矩形与给定边界相交，则返回 `true`。两个边界
	// 如果至少有一个公共点，则相交。
	intersects: function (bounds) { // (Bounds) -> Boolean
		bounds = toBounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	},

	// @method overlaps(otherBounds: Bounds): Boolean
	// 如果矩形与给定边界重叠，则返回 `true`。两个边界
	// 如果它们的交集是一个区域，则重叠。
	overlaps: function (bounds) { // (Bounds) -> Boolean
		bounds = toBounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xOverlaps = (max2.x > min.x) && (min2.x < max.x),
		    yOverlaps = (max2.y > min.y) && (min2.y < max.y);

		return xOverlaps && yOverlaps;
	},

	// @method isValid(): Boolean
	// 如果边界正确初始化，则返回 `true`。
	isValid: function () {
		return !!(this.min && this.max);
	},


	// @method pad(bufferRatio: Number): Bounds
	// 返回通过向每个方向按给定比例扩展或收缩当前边界而生成的边界。
	// 例如，比例为 0.5 时，会在每个方向上扩展 50% 的边界。
	// 负值会收缩边界。
	pad: function (bufferRatio) {
		var min = this.min,
		max = this.max,
		heightBuffer = Math.abs(min.x - max.x) * bufferRatio,
		widthBuffer = Math.abs(min.y - max.y) * bufferRatio;


		return toBounds(
			toPoint(min.x - heightBuffer, min.y - widthBuffer),
			toPoint(max.x + heightBuffer, max.y + widthBuffer));
	},


	// @method equals(otherBounds: Bounds): Boolean
	// 如果矩形与给定边界等价，则返回 `true`。
	equals: function (bounds) {
		if (!bounds) { return false; }

		bounds = toBounds(bounds);

		return this.min.equals(bounds.getTopLeft()) &&
			this.max.equals(bounds.getBottomRight());
	},
};


// @factory L.bounds(corner1: Point, corner2: Point)
// 从两个角坐标对创建 边界 对象。
// @alternative
// @factory L.bounds(points: Point[])
// 从给定的点数组创建 边界 对象。
export function toBounds(a, b) {
	if (!a || a instanceof Bounds) {
		return a;
	}
	return new Bounds(a, b);
}
