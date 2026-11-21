import {LatLng} from '../LatLng';
import {Bounds} from '../../geometry/Bounds';
import {Point} from '../../geometry/Point';

/*
 * @namespace Projection
 * @section
 * Leaflet 自带一组预定义的投影格式：
 *
 * @projection L.Projection.LonLat
 *
 * 等角或plate carree 投影——最简单的投影方式，
 * 主要被 GIS 爱好者使用。将 `x` 映射为经度，将 `y` 映射为
 * 纬度。也适用于平面世界，例如游戏地图。被 `EPSG:4326` 和 `Simple` CRS 所采用。
 * `EPSG:4326` and `Simple` CRS.
 */

export var LonLat = {
	project: function (latlng) {
		return new Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new LatLng(point.y, point.x);
	},

	bounds: new Bounds([-180, -90], [180, 90])
};
