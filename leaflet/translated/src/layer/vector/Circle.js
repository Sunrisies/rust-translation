import {CircleMarker} from './CircleMarker';
import {Path} from './Path';
import * as Util from '../../core/Util';
import {toLatLng} from '../../geo/LatLng';
import {LatLngBounds} from '../../geo/LatLngBounds';
import {Earth} from '../../geo/crs/CRS.Earth';


/*
 * @class Circle
 * @aka L.Circle
 * @inherits CircleMarker
 *
 * 一个用于在地图上绘制圆形覆盖层的类。继承自 `CircleMarker`。
 *
 * 这是一个近似结果，在靠近极点处会偏离真实的圆形（由于投影失真所致）。
 *
 * @example
 *
 * ```js
 * L.circle([50.5, 30.5], {radius: 200}).addTo(map);
 * ```
 */

export var Circle = CircleMarker.extend({

	initialize: function (latlng, options, legacyOptions) {
		if (typeof options === 'number') {
			// 与 0.7.x 版本的工厂方法具有向后兼容性（latlng、radius、options？）
			options = Util.extend({}, legacyOptions, {radius: options});
		}
		Util.setOptions(this, options);
		this._latlng = toLatLng(latlng);

		if (isNaN(this.options.radius)) { throw new Error('Circle radius cannot be NaN'); }

		// @section
		// @aka Circle options
		// @option radius: Number; Radius of the circle, in meters.
		this._mRadius = this.options.radius;
	},

	// @method setRadius(radius: Number): this
	// 设置圆形的半径。单位以米为单位。
	setRadius: function (radius) {
		this._mRadius = radius;
		return this.redraw();
	},

	// @method getRadius(): Number
	// 返回当前圆形的半径。单位以米为单位。
	getRadius: function () {
		return this._mRadius;
	},

	// @method getBounds(): LatLngBounds
	// 返回路径的 `LatLngBounds` 范围。
	getBounds: function () {
		var half = [this._radius, this._radiusY || this._radius];

		return new LatLngBounds(
			this._map.layerPointToLatLng(this._point.subtract(half)),
			this._map.layerPointToLatLng(this._point.add(half)));
	},

	setStyle: Path.prototype.setStyle,

	_project: function () {

		var lng = this._latlng.lng,
		    lat = this._latlng.lat,
		    map = this._map,
		    crs = map.options.crs;

		if (crs.distance === Earth.distance) {
			var d = Math.PI / 180,
			    latR = (this._mRadius / Earth.R) / d,
			    top = map.project([lat + latR, lng]),
			    bottom = map.project([lat - latR, lng]),
			    p = top.add(bottom).divideBy(2),
			    lat2 = map.unproject(p).lat,
			    lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
			            (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;

			if (isNaN(lngR) || lngR === 0) {
				lngR = latR / Math.cos(Math.PI / 180 * lat); // Fallback for edge case, #2425
			}

			this._point = p.subtract(map.getPixelOrigin());
			this._radius = isNaN(lngR) ? 0 : p.x - map.project([lat2, lng - lngR]).x;
			this._radiusY = p.y - top.y;

		} else {
			var latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));

			this._point = map.latLngToLayerPoint(this._latlng);
			this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
		}

		this._updateBounds();
	}
});

// @factory L.circle(latlng: LatLng, options?: Circle options)
// 根据地理点和一个包含圆形半径的选项对象，实例化一个圆形对象。
// 该选项对象包含了圆形半径的值。
// @alternative
// @factory L.circle(latlng: LatLng, radius: Number, options?: Circle options)
// 这是用于与 0.7.x 代码兼容的已废弃的圆形实例化方式。
// 在新应用或插件中不要使用此方法。
export function circle(latlng, options, legacyOptions) {
	return new Circle(latlng, options, legacyOptions);
}
