import {CRS} from './CRS';
import * as Util from '../../core/Util';

/*
 * @namespace CRS
 * @crs L.CRS.Earth
 *
 * 作为全球性的CRS基础，能够覆盖整个地球。
 * 只能用作其他 CRS 的基础，不能直接使用。
 * 因为它没有 `code`、`projection` 或 `transformation`。`distance()` 返回
 * meters.
 */

export var Earth = Util.extend({}, CRS, {
	wrapLng: [-180, 180],

	// 平均地球半径，这是国际大地测量与地球物理学联合会推荐的用法。
	// 
	// 参见 https://rosettacode.org/wiki/Haversine_formula
	R: 6371000,

	// 使用球面余弦定律近似计算两个地理点之间的距离
	distance: function (latlng1, latlng2) {
		var rad = Math.PI / 180,
		    lat1 = latlng1.lat * rad,
		    lat2 = latlng2.lat * rad,
		    sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2),
		    sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2),
		    a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
		    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return this.R * c;
	}
});
