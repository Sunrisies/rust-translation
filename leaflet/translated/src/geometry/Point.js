import {isArray, formatNum} from '../core/Util';

/*
 * @class Point
 * @aka L.Point
 *
 * 表示具有 `x` 和 `y` 像素坐标的点。
 *
 * @example
 *
 * ```js
 * var point = L.point(200, 300);
 * ```
 *
 * All Leaflet methods and options that accept `Point` objects also accept them in a simple Array form (unless noted otherwise), so these lines are equivalent:
 *
 * ```js
 * map.panBy([200, 300]);
 * map.panBy(L.point(200, 300));
 * ```
 *
 * Note that `Point` does not inherit from Leaflet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

export function Point(x, y, round) {
	// @property x: Number; The `x` coordinate of the point
	this.x = (round ? Math.round(x) : x);
	// @property y: Number; The `y` coordinate of the point
	this.y = (round ? Math.round(y) : y);
}

var trunc = Math.trunc || function (v) {
	return v > 0 ? Math.floor(v) : Math.ceil(v);
};

Point.prototype = {

	// @method clone(): Point
	// 返回当前点的副本。
	clone: function () {
		return new Point(this.x, this.y);
	},

	// @method add(otherPoint: Point): Point
	// 返回当前点与给定点相加的结果。
	add: function (point) {
		// 非破坏性，返回新点。
		return this.clone()._add(toPoint(point));
	},

	_add: function (point) {
		// 破坏性，在安全修改现有点的情况下直接用于提升性能。
		this.x += point.x;
		this.y += point.y;
		return this;
	},

	// @method subtract(otherPoint: Point): Point
	// 返回当前点减去给定点的结果。
	subtract: function (point) {
		return this.clone()._subtract(toPoint(point));
	},

	_subtract: function (point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	},

	// @method divideBy(num: Number): Point
	// 返回当前点除以给定数的结果。
	divideBy: function (num) {
		return this.clone()._divideBy(num);
	},

	_divideBy: function (num) {
		this.x /= num;
		this.y /= num;
		return this;
	},

	// @method multiplyBy(num: Number): Point
	// 返回当前点乘以给定数的结果。
	multiplyBy: function (num) {
		return this.clone()._multiplyBy(num);
	},

	_multiplyBy: function (num) {
		this.x *= num;
		this.y *= num;
		return this;
	},

	// @method scaleBy(scale: Point): Point
	// 将当前点的每个坐标乘以 `scale` 的每个坐标。在线性代数中，即将点乘以由 `scale` 定义的因子。
	// `scale`. In linear algebra terms, multiply the point by the
	// [scaling matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation)
	// 将当前点的每个坐标除以 `scale` 的每个坐标。
	scaleBy: function (point) {
		return new Point(this.x * point.x, this.y * point.y);
	},

	// @method unscaleBy(scale: Point): Point
	// 是 `scaleBy` 的逆运算。将当前点的每个坐标除以 `scale` 的每个坐标。
	// 将当前点的每个坐标乘以 `scale` 的对应坐标。
	unscaleBy: function (point) {
		return new Point(this.x / point.x, this.y / point.y);
	},

	// @method round(): Point
	// 返回具有四舍五入坐标的当前点副本。
	round: function () {
		return this.clone()._round();
	},

	_round: function () {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	},

	// @method floor(): Point
	// 返回具有向下取整坐标的当前点副本。
	floor: function () {
		return this.clone()._floor();
	},

	_floor: function () {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	},

	// @method ceil(): Point
	// 返回具有向上取整坐标的当前点副本。
	ceil: function () {
		return this.clone()._ceil();
	},

	_ceil: function () {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	},

	// @method trunc(): Point
	// 返回具有截断坐标的当前点副本（向零方向四舍五入）。
	trunc: function () {
		return this.clone()._trunc();
	},

	_trunc: function () {
		this.x = trunc(this.x);
		this.y = trunc(this.y);
		return this;
	},

	// @method distanceTo(otherPoint: Point): Number
	// 返回当前点与给定点之间的笛卡尔距离。
	distanceTo: function (point) {
		point = toPoint(point);

		var x = point.x - this.x,
		    y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	},

	// @method equals(otherPoint: Point): Boolean
	// 如果给定点的坐标与当前点相同，则返回 `true`。
	equals: function (point) {
		point = toPoint(point);

		return point.x === this.x &&
		       point.y === this.y;
	},

	// @method contains(otherPoint: Point): Boolean
	// 如果给定点的两个坐标的绝对值都小于对应当前点坐标，则返回 `true`。
	contains: function (point) {
		point = toPoint(point);

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	},

	// @method toString(): String
	// 返回用于调试的点字符串表示形式。
	toString: function () {
		return 'Point(' +
		        formatNum(this.x) + ', ' +
		        formatNum(this.y) + ')';
	}
};

// @factory L.point(x: Number, y: Number, round?: Boolean)
// 根据给定的 `x` 和 `y` 坐标创建 Point 对象。如果可选参数 `round` 设置为 true，则对 `x` 和 `y` 值进行四舍五入。

// @alternative
// @factory L.point(coords: Number[])
// 期望以 `[x, y]` 形式的数组输入。

// @alternative
// @factory L.point(coords: Object)
// 期望以 `{x: Number, y: Number}` 形式的普通对象输入。
export function toPoint(x, y, round) {
	if (x instanceof Point) {
		return x;
	}
	if (isArray(x)) {
		return new Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	if (typeof x === 'object' && 'x' in x && 'y' in x) {
		return new Point(x.x, x.y);
	}
	return new Point(x, y, round);
}
