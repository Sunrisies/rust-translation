import {Point} from './Point';
import * as Util from '../core/Util';

/*
 * @class Transformation
 * @aka L.Transformation
 *
 * 表示仿射变换：一组系数 `a`、`b`、`c`、`d`
 * 用于将形式为 `(x, y)` 的点转换为 `(a*x + b, c*y + d)`，并执行
 * 反向转换。被 Leaflet 的投影代码使用。
 *
 * @example
 *
 * ```js
 * var transformation = L.transformation(2, 5, -1, 10),
 * 	p = L.point(1, 2),
 * 	p2 = transformation.transform(p), //  L.point(7, 8)
 * 	p3 = transformation.untransform(p2); //  L.point(1, 2)
 * ```
 */


// 工厂方法 new L.Transformation(a: Number, b: Number, c: Number, d: Number)
// 使用给定的系数创建 `Transformation` 对象。
export function Transformation(a, b, c, d) {
	if (Util.isArray(a)) {
		// 使用数组属性
		this._a = a[0];
		this._b = a[1];
		this._c = a[2];
		this._d = a[3];
		return;
	}
	this._a = a;
	this._b = b;
	this._c = c;
	this._d = d;
}

Transformation.prototype = {
	// @method transform(point: Point, scale?: Number): Point
	// 返回经过变换后的点，可选择性地乘以给定的比例。
	// 仅接受实际的 `L.Point` 实例，而非数组。
	transform: function (point, scale) { // (Point, Number) -> Point
		return this._transform(point.clone(), scale);
	},

	// 破坏性转换（速度更快）
	_transform: function (point, scale) {
		scale = scale || 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	},

	// @method untransform(point: Point, scale?: Number): Point
	// 返回给定点的反向转换结果，可选择性地除以
	// 给定的比例。仅接受实际的 `L.Point` 实例，而非数组。
	untransform: function (point, scale) {
		scale = scale || 1;
		return new Point(
		        (point.x / scale - this._b) / this._a,
		        (point.y / scale - this._d) / this._c);
	}
};

// 工厂方法 L.transformation(a: Number, b: Number, c: Number, d: Number)

// @factory L.transformation(a: Number, b: Number, c: Number, d: Number)
// 使用给定的系数实例化 `Transformation` 对象。

// @alternative
// @factory L.transformation(coefficients: Array): Transformation
// 要求系数数组具有以下形式
// `[a: Number, b: Number, c: Number, d: Number]`。

export function toTransformation(a, b, c, d) {
	return new Transformation(a, b, c, d);
}
