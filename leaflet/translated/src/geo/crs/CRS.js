
import {Bounds} from '../../geometry/Bounds';
import {LatLng} from '../LatLng';
import {LatLngBounds} from '../LatLngBounds';
import * as Util from '../../core/Util';

/*
 * @namespace CRS
 * @crs L.CRS.Base
 * 用于定义坐标参考系统的对象，可将地理点投影到像素（屏幕）坐标，并反向转换回其他单位的坐标，适用于 [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) 服务。参见
 * geographical points into pixel (screen) coordinates and back (and to
 * coordinates in other units for [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services). See
 * [spatial reference system](https://en.wikipedia.org/wiki/Spatial_reference_system).
 *
 * Leaflet 默认定义了最常用的 CRS。如果您想使用未默认定义的 CRS，请查看
 * CRS not defined by default, take a look at the
 * [Proj4Leaflet](https://github.com/kartena/Proj4Leaflet) plugin.
 *
 * 请注意，CRS 实例不继承自 Leaflet 的 `Class` 对象，
 * 且无法被实例化。此外，新类也无法从它们继承，
 * 也不能通过 `include` 函数向它们添加方法。
 */

export var CRS = {
	// @method latLngToPoint(latlng: LatLng, zoom: Number): Point
	// 将地理坐标投影为给定缩放级别的像素坐标。
	latLngToPoint: function (latlng, zoom) {
		var projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	// @method pointToLatLng(point: Point, zoom: Number): LatLng
	// `latLngToPoint` 的反向操作。将像素坐标按给定
	// 缩放级别转换回地理坐标。
	pointToLatLng: function (point, zoom) {
		var scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	// @method project(latlng: LatLng): Point
	// 将地理坐标转换为该 CRS 所接受的单位中的坐标，
	// 例如，对于 EPSG:3857，则转换为米以传递给 WMS 服务。
	project: function (latlng) {
		return this.projection.project(latlng);
	},

	// @method unproject(point: Point): LatLng
	// 给定投影坐标后返回对应的 LatLng。
	// `project` 的反向操作。
	unproject: function (point) {
		return this.projection.unproject(point);
	},

	// @method scale(zoom: Number): Number
	// 返回将投影坐标转换为
	// 特定缩放级别的像素坐标时使用的比例。例如，对于基于 Mercator 的 CRS，它返回
	// `256 * 2^zoom`。
	scale: function (zoom) {
		return 256 * Math.pow(2, zoom);
	},

	// @method zoom(scale: Number): Number
	// `scale()` 的反向操作，返回与 `scale` 的比例因子对应的缩放级别。
	// factor of `scale`.
	zoom: function (scale) {
		return Math.log(scale / 256) / Math.LN2;
	},

	// @method getProjectedBounds(zoom: Number): Bounds
	// 返回针对提供的 `zoom` 进行缩放和转换后的投影范围。
	getProjectedBounds: function (zoom) {
		if (this.infinite) { return null; }

		var b = this.projection.bounds,
		    s = this.scale(zoom),
		    min = this.transformation.transform(b.min, s),
		    max = this.transformation.transform(b.max, s);

		return new Bounds(min, max);
	},

	// @method distance(latlng1: LatLng, latlng2: LatLng): Number
	// 返回两个地理坐标之间的距离。

	// @property code: String
	// 传递给 WMS 服务的 CRS 的标准代码名（例如 `'EPSG:3857'`）
	//
	// @property wrapLng: Number[]
	// 定义经度（水平）坐标
	// 轴是否绕给定范围循环以及方式的两个数字数组。在大多数
	// 地理 CRS 中，默认值为 `[-180, 180]`。如果为 `undefined`，经度轴不会循环。
	//
	// @property wrapLat: Number[]
	// 类似于 `wrapLng`，但适用于纬度（垂直）轴。

	// wrapLng: [min, max],
	// wrapLat: [min, max],

	// @property infinite: Boolean
	// 如果为真，坐标空间将无边界（两个轴均为无限大）
	infinite: false,

	// @method wrapLatLng(latlng: LatLng): LatLng
	// 返回根据规则进行循环处理的 `LatLng` 对象。
	// 如果CRS的`wrapLat`和`wrapLng`属性超出CRS范围，则会产生异常。
	wrapLatLng: function (latlng) {
		var lng = this.wrapLng ? Util.wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng,
		    lat = this.wrapLat ? Util.wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat,
		    alt = latlng.alt;

		return new LatLng(lat, lng, alt);
	},

	// @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
	// 返回一个与给定`LatLngBounds`大小相同的`LatLngBounds`对象，以确保其中心位于CRS范围内。
	// 确保其中心在CRS边界内。
	// 仅接受实际的`L.LatLngBounds`实例，而不接受数组。
	wrapLatLngBounds: function (bounds) {
		var center = bounds.getCenter(),
		    newCenter = this.wrapLatLng(center),
		    latShift = center.lat - newCenter.lat,
		    lngShift = center.lng - newCenter.lng;

		if (latShift === 0 && lngShift === 0) {
			return bounds;
		}

		var sw = bounds.getSouthWest(),
		    ne = bounds.getNorthEast(),
		    newSw = new LatLng(sw.lat - latShift, sw.lng - lngShift),
		    newNe = new LatLng(ne.lat - latShift, ne.lng - lngShift);

		return new LatLngBounds(newSw, newNe);
	}
};
