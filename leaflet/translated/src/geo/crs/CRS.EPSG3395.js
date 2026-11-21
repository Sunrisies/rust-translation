import {Earth} from './CRS.Earth';
import {Mercator} from '../projection/Projection.Mercator';
import {toTransformation} from '../../geometry/Transformation';
import * as Util from '../../core/Util';

/*
 * @namespace CRS
 * @crs L.CRS.EPSG3395
 *
 * 一些商业瓷砖供应商很少使用此方式。采用椭圆墨卡托投影法。
 */
export var EPSG3395 = Util.extend({}, Earth, {
	code: 'EPSG:3395',
	projection: Mercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * Mercator.R);
		return toTransformation(scale, 0.5, -scale, 0.5);
	}())
});
