import * as Util from '../core/Util';
import {Earth} from './crs/CRS.Earth';
import {toLatLngBounds} from './LatLngBounds';

/* @class LatLng
 * @aka L.LatLng
 *
 * 表示具有特定经度和纬度的地理点。
 *
 * @example
 *
 * ```
 * var latlng = L.latLng(50.5, 30.5);
 * ```
 *
 * All Leaflet methods that accept LatLng objects also accept them in a simple Array form and simple object form (unless noted otherwise), so these lines are equivalent:
 *
 * ```
 * map.panTo([50, 30]);
 * map.panTo({lon: 30, lat: 50});
 * map.panTo({lat: 50, lng: 30});
 * map.panTo(L.latLng(50, 30));
 * ```
 *
 * Note that `LatLng` does not inherit from Leaflet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

export function LatLng(lat, lng, alt) {
	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
	}

	// @property lat: Number
	// 度数形式的纬度。
	this.lat = +lat;

	// @property lng: Number
	// 度数形式的经度。
	this.lng = +lng;

	// @property alt: Number
	// 米数形式的海拔（可选）。
	if (alt !== undefined) {
		this.alt = +alt;
	}
}

LatLng.prototype = {
	// @method equals(otherLatLng: LatLng, maxMargin?: Number): Boolean
	// 如果给定的 `LatLng` 点位于同一位置（误差范围在允许范围内），则返回 `true`。通过设置 `maxMargin` 为较小数值可以覆盖这个误差范围。
	equals: function (obj, maxMargin) {
		if (!obj) { return false; }

		obj = toLatLng(obj);

		var margin = Math.max(
		        Math.abs(this.lat - obj.lat),
		        Math.abs(this.lng - obj.lng));

		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	},

	// @method toString(): String
	// 返回该点的字符串表示形式（用于调试）。
	toString: function (precision) {
		return 'LatLng(' +
		        Util.formatNum(this.lat, precision) + ', ' +
		        Util.formatNum(this.lng, precision) + ')';
	},

	// @method distanceTo(otherLatLng: LatLng): Number
	// 使用[球面余弦定律](https://en.wikipedia.org/wiki/Spherical_law_of_cosines)计算给定 `LatLng` 的距离（以米为单位）。
	distanceTo: function (other) {
		return Earth.distance(this, toLatLng(other));
	},

	// @method wrap(): LatLng
	// 创建一个新的 `LatLng` 对象，将经度值进行偏移，使其始终位于 -180 到 +180 度之间。
	wrap: function () {
		return Earth.wrapLatLng(this);
	},

	// @method toBounds(sizeInMeters: Number): LatLngBounds
	// 创建一个新的 `LatLngBounds` 对象，其中每个边界与 `LatLng` 之间的距离为 `sizeInMeters/2` 米。
	toBounds: function (sizeInMeters) {
		var latAccuracy = 180 * sizeInMeters / 40075017,
		    lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

		return toLatLngBounds(
		        [this.lat - latAccuracy, this.lng - lngAccuracy],
		        [this.lat + latAccuracy, this.lng + lngAccuracy]);
	},

	clone: function () {
		return new LatLng(this.lat, this.lng, this.alt);
	}
};



// @factory L.latLng(latitude: Number, longitude: Number, altitude?: Number): LatLng
// 创建表示给定经度和纬度（可选海拔）的地理点对象。

// @alternative
// @factory L.latLng(coords: Array): LatLng
// 期望以 `[Number, Number]` 或 `[Number, Number, Number]` 形式提供的数组。

// @alternative
// @factory L.latLng(coords: Object): LatLng
// 期望以 `{lat: Number, lng: Number}` 或 `{lat: Number, lng: Number, alt: Number}` 形式的普通对象。

export function toLatLng(a, b, c) {
	if (a instanceof LatLng) {
		return a;
	}
	if (Util.isArray(a) && typeof a[0] !== 'object') {
		if (a.length === 3) {
			return new LatLng(a[0], a[1], a[2]);
		}
		if (a.length === 2) {
			return new LatLng(a[0], a[1]);
		}
		return null;
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
	}
	if (b === undefined) {
		return null;
	}
	return new LatLng(a, b, c);
}
