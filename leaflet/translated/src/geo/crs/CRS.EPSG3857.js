import {Earth} from './CRS.Earth';
import {SphericalMercator} from '../projection/Projection.SphericalMercator';
import {toTransformation} from '../../geometry/Transformation';
import * as Util from '../../core/Util';

/*
 * @namespace CRS
 * @crs L.CRS.EPSG3857
 *
 * 这是在线地图最常用的CRS，几乎所有的免费和商业
 * 瓦片提供商会使用它。采用球面墨卡托投影方式。默认情况下通过
 * 地图的 `crs` 选项进行设置。
 */

export var EPSG3857 = Util.extend({}, Earth, {
	code: 'EPSG:3857',
	projection: SphericalMercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * SphericalMercator.R);
		return toTransformation(scale, 0.5, -scale, 0.5);
	}())
});

export var EPSG900913 = Util.extend({}, EPSG3857, {
	code: 'EPSG:900913'
});
