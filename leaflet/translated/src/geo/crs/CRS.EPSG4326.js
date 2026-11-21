import {Earth} from './CRS.Earth';
import {LonLat} from '../projection/Projection.LonLat';
import {toTransformation} from '../../geometry/Transformation';
import * as Util from '../../core/Util';

/*
 * @namespace CRS
 * @crs L.CRS.EPSG4326
 *
 * GIS 爱好者中常见的 CRS。采用简单的等距投影方式。
 *
 * Leaflet 1.0.x 符合 [EPSG:4326 的 TMS 坐标方案](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification#global-geodetic)，
 * 这与 0.7.x 版本的行为不同。如果您使用 `TileLayer` 并采用此 CRS，请确保有两块 256x256 像素的瓦片覆盖
 * with this CRS, ensure that there are two 256x256 pixel tiles covering the
 * 整个地球在零缩放级别下，且瓦片坐标原点为 (-180,+90)，
 * 或者对于设置了 [`tms` 选项](#tilelayer-tms) 的 `TileLayer` 来说，原点为 (-180,-90)。
 */

export var EPSG4326 = Util.extend({}, Earth, {
	code: 'EPSG:4326',
	projection: LonLat,
	transformation: toTransformation(1 / 180, 1, -1 / 180, 0.5)
});
