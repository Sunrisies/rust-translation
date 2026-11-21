import {LatLng} from '../LatLng';
import {Bounds} from '../../geometry/Bounds';
import {Point} from '../../geometry/Point';

/*
 * @namespace Projection
 * @projection L.Projection.SphericalMercator
 *
 * 球面墨卡托投影——这是在线地图最常用的投影方式，
 * 几乎所有免费和商业瓦片提供商会使用这种投影。它假设地球是
 * 一个球体。该投影采用 `EPSG:3857` 坐标参考系统。
 */

var earthRadius = 6378137;

export var SphericalMercator = {

	R: earthRadius,
	MAX_LATITUDE: 85.0511287798,

	project: function (latlng) {
		var d = Math.PI / 180,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    sin = Math.sin(lat * d);

		return new Point(
			this.R * latlng.lng * d,
			this.R * Math.log((1 + sin) / (1 - sin)) / 2);
	},

	unproject: function (point) {
		var d = 180 / Math.PI;

		return new LatLng(
			(2 * Math.atan(Math.exp(point.y / this.R)) - (Math.PI / 2)) * d,
			point.x * d / this.R);
	},

	bounds: (function () {
		var d = earthRadius * Math.PI;
		return new Bounds([-d, -d], [d, d]);
	})()
};
