import {CRS} from './CRS';
import {LonLat} from '../projection/Projection.LonLat';
import {toTransformation} from '../../geometry/Transformation';
import * as Util from '../../core/Util';

/*
 * @namespace CRS
 * @crs L.CRS.Simple
 *
 * 一个简单的 CRS，能够将经度和纬度直接映射为 `x` 和 `y`。
 * 可用于表示平坦表面的地图（例如游戏地图）。请注意，`y`
 * 轴仍然需要反方向排列（从下到上）。`distance()` 函数返回
 * 简单的欧几里得距离。
 */

export var Simple = Util.extend({}, CRS, {
	projection: LonLat,
	transformation: toTransformation(1, 0, -1, 0),

	scale: function (zoom) {
		return Math.pow(2, zoom);
	},

	zoom: function (scale) {
		return Math.log(scale) / Math.LN2;
	},

	distance: function (latlng1, latlng2) {
		var dx = latlng2.lng - latlng1.lng,
		    dy = latlng2.lat - latlng1.lat;

		return Math.sqrt(dx * dx + dy * dy);
	},

	infinite: true
});
