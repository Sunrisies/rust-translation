import {LayerGroup} from './LayerGroup';
import {FeatureGroup} from './FeatureGroup';
import * as Util from '../core/Util';
import {Marker} from './marker/Marker';
import {Circle} from './vector/Circle';
import {CircleMarker} from './vector/CircleMarker';
import {Polyline} from './vector/Polyline';
import {Polygon} from './vector/Polygon';
import {LatLng} from '../geo/LatLng';
import * as LineUtil from '../geometry/LineUtil';
import {toLatLng} from '../geo/LatLng';


/*
 * @class GeoJSON
 * @aka L.GeoJSON
 * @inherits FeatureGroup
 *
 * 表示一个 GeoJSON 对象或多个 GeoJSON 对象的数组。用于解析
 * GeoJSON 数据并在地图上显示它。扩展 `FeatureGroup`。
 *
 * @example
 *
 * ```js
 * L.geoJSON(data, {
 * 	style: function (feature) {
 * 		return {color: feature.properties.color};
 * 	}
 * }).bindPopup(function (layer) {
 * 	return layer.feature.properties.description;
 * }).addTo(map);
 * ```
 */

export var GeoJSON = FeatureGroup.extend({

	/* @section
	 * @aka GeoJSON options
	 *
	 * @option pointToLayer: Function = *
	 * 定义一个 `Function`，指定 GeoJSON 点如何生成 Leaflet 图层。在添加数据时内部调用此函数，传递 GeoJSON 点特征及其 `LatLng` 坐标。
	 * called when data is added, passing the GeoJSON point feature and its `LatLng`.
	 * 默认情况下会生成默认的 `Marker`：
	 * ```js
	 * function(geoJsonPoint, latlng)
	 * 	return L.marker(latlng);
	 * }
	 * ```
	 *
	 * @option style: Function = *
	 * 定义一个 `Function`，指定用于样式化的 GeoJSON 线形和多边形的 `Path options`。 在添加数据时内部调用此函数。
	 * called internally when data is added.
	 * 默认值是不覆盖任何默认设置：
	 * ```js
	 * function (geoJsonFeature) {
	 * 	return {}
	 * }
	 * ```
	 *
	 * @option onEachFeature: Function = *
	 * 一个 `Function`，针对每个创建的 `Feature` 调用一次，在特征创建并样式化后执行。适用于为特征附加事件和弹出框。
	 * been created and styled. Useful for attaching events and popups to features.
	 * 默认情况下不对新创建的图层做任何操作：
	 * ```js
	 * function (feature, layer) {}
	 * ```
	 *
	 * @option filter: Function = *
	 * 一个 `Function`，用于决定是否包含某个特征。
	 * 默认情况下包含所有特征：
	 * ```js
	 * function (geoJsonFeature) {
	 * 	return true;
	 * }
	 * ```
	 * 注意：动态更改 `filter` 选项仅对新添加的数据有效，不会重新评估已包含的特征。
	 * 动态改变 `filter` 选项仅对新添加的数据生效。
	 *
	 * @option coordsToLatLng: Function = *
	 * 一个 `Function`，用于将 GeoJSON 坐标转换为 `LatLng`。
	 * 默认使用 `coordsToLatLng` 静态方法。
	 *
	 * @option markersInheritOptions: Boolean = false
	 * “点”类型特征默认的 `Marker` 是否继承组选项设置。
	 */

	initialize: function (geojson, options) {
		Util.setOptions(this, options);

		this._layers = {};

		if (geojson) {
			this.addData(geojson);
		}
	},

	// @method addData( <GeoJSON> data ): this
	// 将 GeoJSON 对象添加到图层中。
	addData: function (geojson) {
		var features = Util.isArray(geojson) ? geojson : geojson.features,
		    i, len, feature;

		if (features) {
			for (i = 0, len = features.length; i < len; i++) {
				// 仅在几何信息已设置且不为空时添加此操作。
				feature = features[i];
				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
					this.addData(feature);
				}
			}
			return this;
		}

		var options = this.options;

		if (options.filter && !options.filter(geojson)) { return this; }

		var layer = geometryToLayer(geojson, options);
		if (!layer) {
			return this;
		}
		layer.feature = asFeature(geojson);

		layer.defaultOptions = layer.options;
		this.resetStyle(layer);

		if (options.onEachFeature) {
			options.onEachFeature(geojson, layer);
		}

		return this.addLayer(layer);
	},

	// @method resetStyle( <Path> layer? ): this
	// 将给定矢量图层的样式重置为原始 GeoJSON 样式，适用于悬停事件后重新设置样式。
	// 如果省略 `layer` 参数，则当前图层中所有特征的样式都会被重置。
	resetStyle: function (layer) {
		if (layer === undefined) {
			return this.eachLayer(this.resetStyle, this);
		}
		// 重置所有自定义样式。
		layer.options = Util.extend({}, layer.defaultOptions);
		this._setLayerStyle(layer, this.options.style);
		return this;
	},

	// @method setStyle( <Function> style ): this
	// 使用给定的样式函数更改 GeoJSON 矢量图层的样式。
	setStyle: function (style) {
		return this.eachLayer(function (layer) {
			this._setLayerStyle(layer, style);
		}, this);
	},

	_setLayerStyle: function (layer, style) {
		if (layer.setStyle) {
			if (typeof style === 'function') {
				style = style(layer.feature);
			}
			layer.setStyle(style);
		}
	}
});

// @section
// 有一些无需实例化 L.GeoJSON 即可调用的静态函数：

// @function geometryToLayer(featureData: Object, options?: GeoJSON options): Layer
// 从给定的 GeoJSON 特征创建 `Layer`。如果提供选项，可以使用自定义函数。
// [`pointToLayer`](#geojson-pointtolayer) and/or [`coordsToLatLng`](#geojson-coordstolatlng)
// 从两个数字（经度、纬度）或三个数字（经度、纬度、高度）数组创建 `LatLng` 对象。
export function geometryToLayer(geojson, options) {

	var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
	    coords = geometry ? geometry.coordinates : null,
	    layers = [],
	    pointToLayer = options && options.pointToLayer,
	    _coordsToLatLng = options && options.coordsToLatLng || coordsToLatLng,
	    latlng, latlngs, i, len;

	if (!coords && !geometry) {
		return null;
	}

	switch (geometry.type) {
	case 'Point':
		latlng = _coordsToLatLng(coords);
		return _pointToLayer(pointToLayer, geojson, latlng, options);

	case 'MultiPoint':
		for (i = 0, len = coords.length; i < len; i++) {
			latlng = _coordsToLatLng(coords[i]);
			layers.push(_pointToLayer(pointToLayer, geojson, latlng, options));
		}
		return new FeatureGroup(layers);

	case 'LineString':
	case 'MultiLineString':
		latlngs = coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
		return new Polyline(latlngs, options);

	case 'Polygon':
	case 'MultiPolygon':
		latlngs = coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
		return new Polygon(latlngs, options);

	case 'GeometryCollection':
		for (i = 0, len = geometry.geometries.length; i < len; i++) {
			var geoLayer = geometryToLayer({
				geometry: geometry.geometries[i],
				type: 'Feature',
				properties: geojson.properties
			}, options);

			if (geoLayer) {
				layers.push(geoLayer);
			}
		}
		return new FeatureGroup(layers);

	case 'FeatureCollection':
		for (i = 0, len = geometry.features.length; i < len; i++) {
			var featureLayer = geometryToLayer(geometry.features[i], options);

			if (featureLayer) {
				layers.push(featureLayer);
			}
		}
		return new FeatureGroup(layers);

	default:
		throw new Error('Invalid GeoJSON object.');
	}
}

function _pointToLayer(pointToLayerFn, geojson, latlng, options) {
	return pointToLayerFn ?
		pointToLayerFn(geojson, latlng) :
		new Marker(latlng, options && options.markersInheritOptions && options);
}

// @function coordsToLatLng(coords: Array): LatLng
// Creates a `LatLng` object from an array of 2 numbers (longitude, latitude)
// or 3 numbers (longitude, latitude, altitude) used in GeoJSON for points.
export function coordsToLatLng(coords) {
	return new LatLng(coords[1], coords[0], coords[2]);
}

// @function coordsToLatLngs(coords: Array, levelsDeep?: Number, coordsToLatLng?: Function): Array
// 从 GeoJSON 坐标数组创建由 `LatLng` 组成的多维数组。
// `levelsDeep` 指定嵌套层级（0 表示点数组，1 表示点数组的数组等，默认值为 0）。
// 可以使用自定义的 [`coordsToLatLng`](#GeoJSON-coordstolatlng) 函数。
export function coordsToLatLngs(coords, levelsDeep, _coordsToLatLng) {
	var latlngs = [];

	for (var i = 0, len = coords.length, latlng; i < len; i++) {
		latlng = levelsDeep ?
			coordsToLatLngs(coords[i], levelsDeep - 1, _coordsToLatLng) :
			(_coordsToLatLng || coordsToLatLng)(coords[i]);

		latlngs.push(latlng);
	}

	return latlngs;
}

// @function latLngToCoords(latlng: LatLng, precision?: Number|false): Array
// [`coordsToLatLng`](#GeoJSON-coordstolatlng) 的逆操作。
// 坐标值通过 [`formatNum`](#util-formatnum) 函数进行四舍五入。
export function latLngToCoords(latlng, precision) {
	latlng = toLatLng(latlng);
	return latlng.alt !== undefined ?
		[Util.formatNum(latlng.lng, precision), Util.formatNum(latlng.lat, precision), Util.formatNum(latlng.alt, precision)] :
		[Util.formatNum(latlng.lng, precision), Util.formatNum(latlng.lat, precision)];
}

// @function latLngsToCoords(latlngs: Array, levelsDeep?: Number, closed?: Boolean, precision?: Number|false): Array
// [`coordsToLatLngs`](#GeoJSON-coordstolatlngs) 的逆操作。
// `closed` 决定第一个点是否应被添加到数组末尾以闭合要素，仅在 `levelsDeep` 为 0 时使用，默认值为 false。
// 坐标值通过 [`formatNum`](#util-formatnum) 函数进行四舍五入。
export function latLngsToCoords(latlngs, levelsDeep, closed, precision) {
	var coords = [];

	for (var i = 0, len = latlngs.length; i < len; i++) {
		// 检查是否需要扁平化数组，以确保递归过程中不平衡的数组能够正确转换。
		coords.push(levelsDeep ?
			latLngsToCoords(latlngs[i], LineUtil.isFlat(latlngs[i]) ? 0 : levelsDeep - 1, closed, precision) :
			latLngToCoords(latlngs[i], precision));
	}

	if (!levelsDeep && closed && coords.length > 0) {
		coords.push(coords[0].slice());
	}

	return coords;
}

export function getFeature(layer, newGeometry) {
	return layer.feature ?
		Util.extend({}, layer.feature, {geometry: newGeometry}) :
		asFeature(newGeometry);
}

// @function asFeature(geojson: Object): Object
// 将 GeoJSON 几何/要素规范化为 GeoJSON 要素。
export function asFeature(geojson) {
	if (geojson.type === 'Feature' || geojson.type === 'FeatureCollection') {
		return geojson;
	}

	return {
		type: 'Feature',
		properties: {},
		geometry: geojson
	};
}

var PointToGeoJSON = {
	toGeoJSON: function (precision) {
		return getFeature(this, {
			type: 'Point',
			coordinates: latLngToCoords(this.getLatLng(), precision)
		});
	}
};

// @namespace Marker
// @section Other methods
// @method toGeoJSON(precision?: Number|false): Object
// 坐标值通过带有指定 `precision` 的 [`formatNum`](#util-formatnum) 函数进行四舍五入。
// 返回标记的 [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) 表示形式（作为 GeoJSON `Point` Feature）。
Marker.include(PointToGeoJSON);

// @namespace CircleMarker
// @method toGeoJSON(precision?: Number|false): Object
// 坐标值通过带有指定 `precision` 的 [`formatNum`](#util-formatnum) 函数进行四舍五入。
// 返回圆形标记的 [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) 表示形式（作为 GeoJSON `Point` Feature）。
Circle.include(PointToGeoJSON);
CircleMarker.include(PointToGeoJSON);


// @namespace Polyline
// @method toGeoJSON(precision?: Number|false): Object
// 坐标值通过带有指定 `precision` 的 [`formatNum`](#util-formatnum) 函数进行四舍五入。
// 返回多段线的 [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) 表示形式（作为 GeoJSON `LineString` 或 `MultiLineString` Feature）。
Polyline.include({
	toGeoJSON: function (precision) {
		var multi = !LineUtil.isFlat(this._latlngs);

		var coords = latLngsToCoords(this._latlngs, multi ? 1 : 0, false, precision);

		return getFeature(this, {
			type: (multi ? 'Multi' : '') + 'LineString',
			coordinates: coords
		});
	}
});

// @namespace Polygon
// @method toGeoJSON(precision?: Number|false): Object
// 坐标值通过带有指定 `precision` 的 [`formatNum`](#util-formatnum) 函数进行四舍五入。
// 返回多边形的 [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) 表示形式（作为 GeoJSON `Polygon` 或 `MultiPolygon` Feature）。
Polygon.include({
	toGeoJSON: function (precision) {
		var holes = !LineUtil.isFlat(this._latlngs),
		    multi = holes && !LineUtil.isFlat(this._latlngs[0]);

		var coords = latLngsToCoords(this._latlngs, multi ? 2 : holes ? 1 : 0, true, precision);

		if (!holes) {
			coords = [coords];
		}

		return getFeature(this, {
			type: (multi ? 'Multi' : '') + 'Polygon',
			coordinates: coords
		});
	}
});


// @namespace LayerGroup
LayerGroup.include({
	toMultiPoint: function (precision) {
		var coords = [];

		this.eachLayer(function (layer) {
			coords.push(layer.toGeoJSON(precision).geometry.coordinates);
		});

		return getFeature(this, {
			type: 'MultiPoint',
			coordinates: coords
		});
	},

	// @method toGeoJSON(precision?: Number|false): Object
	// 坐标值通过带有指定 `precision` 的 [`formatNum`](#util-formatnum) 函数进行四舍五入。
	// 返回该图层组的 [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) 表示形式（以 GeoJSON `FeatureCollection`、`GeometryCollection` 或 `MultiPoint` 格式呈现）。
	toGeoJSON: function (precision) {

		var type = this.feature && this.feature.geometry && this.feature.geometry.type;

		if (type === 'MultiPoint') {
			return this.toMultiPoint(precision);
		}

		var isGeometryCollection = type === 'GeometryCollection',
		    jsons = [];

		this.eachLayer(function (layer) {
			if (layer.toGeoJSON) {
				var json = layer.toGeoJSON(precision);
				if (isGeometryCollection) {
					jsons.push(json.geometry);
				} else {
					var feature = asFeature(json);
					// 压缩嵌套的要素集合。
					if (feature.type === 'FeatureCollection') {
						jsons.push.apply(jsons, feature.features);
					} else {
						jsons.push(feature);
					}
				}
			}
		});

		if (isGeometryCollection) {
			return getFeature(this, {
				geometries: jsons,
				type: 'GeometryCollection'
			});
		}

		return {
			type: 'FeatureCollection',
			features: jsons
		};
	}
});

// @namespace GeoJSON
// @factory L.geoJSON(geojson?: Object, options?: GeoJSON options)
// 创建一个 GeoJSON 图层。可选择性地接受一个对象
// [GeoJSON format](https://tools.ietf.org/html/rfc7946) to display on the map
// （也可以之后通过 `addData` 方法添加），以及一个 `options` 对象。
export function geoJSON(geojson, options) {
	return new GeoJSON(geojson, options);
}

// 与旧版本兼容。
export var geoJson = geoJSON;
