import {TileLayer} from './TileLayer';
import {extend, setOptions, getParamString} from '../../core/Util';
import Browser from '../../core/Browser';
import {EPSG4326} from '../../geo/crs/CRS.EPSG4326';
import {toBounds} from '../../geometry/Bounds';

/*
 * @class TileLayer.WMS
 * @inherits TileLayer
 * @aka L.TileLayer.WMS
 * 用于在地图上以瓦片层的形式显示 [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) 服务。继承自 `TileLayer` 类。
 *
 * @example
 *
 * ```js
 * var nexrad = L.tileLayer.wms("http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", {
 * 	layers: 'nexrad-n0r-900913',
 * 	format: 'image/png',
 * 	transparent: true,
 * 	attribution: "Weather data © 2012 IEM Nexrad"
 * });
 * ```
 */

export var TileLayerWMS = TileLayer.extend({

	// @section
	// @aka TileLayer.WMS options
	// 如果使用了此处未记录的自定义选项，它们将作为额外参数包含在每个请求 URL 中，并发送至
	// WMS 服务器。这可用于显示所需的 **(required)** 逗号分隔的 WMS 层列表以及 WMS 样式列表。
	// [non-standard vendor WMS parameters](https://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
	defaultWmsParams: {
		service: 'WMS',
		request: 'GetMap',

		// @option layers: String = ''
		// **(required)** Comma-separated list of WMS layers to show.
		layers: '',

		// @option styles: String = ''
		// 逗号分隔的 WMS 样式列表。
		styles: '',

		// @option format: String = 'image/jpeg'
		// WMS 图像格式（对于具有透明度的层，请使用 `'image/png'`）。
		format: 'image/jpeg',

		// @option transparent: Boolean = false
		// 如果设置为 `true`，WMS 服务将返回带有透明度的图像。
		transparent: false,

		// @option version: String = '1.1.1'
		// 要使用的 WMS 服务版本。
		version: '1.1.1'
	},

	options: {
		// @option crs: CRS = null
		// 用于 WMS 请求的坐标参考系统，默认值为
		// 地图坐标参考系统。如果您不确定其含义，请勿更改此值。
		crs: null,

		// @option uppercase: Boolean = false
		// 如果设置为 `true`，WMS 请求参数键将采用大写字母。
		uppercase: false
	},

	initialize: function (url, options) {

		this._url = url;

		var wmsParams = extend({}, this.defaultWmsParams);

		// 所有非 `TileLayer` 选项的键都将归入 WMS 参数中。
		for (var i in options) {
			if (!(i in this.options)) {
				wmsParams[i] = options[i];
			}
		}

		options = setOptions(this, options);

		var realRetina = options.detectRetina && Browser.retina ? 2 : 1;
		var tileSize = this.getTileSize();
		wmsParams.width = tileSize.x * realRetina;
		wmsParams.height = tileSize.y * realRetina;

		this.wmsParams = wmsParams;
	},

	onAdd: function (map) {

		this._crs = this.options.crs || map.options.crs;
		this._wmsVersion = parseFloat(this.wmsParams.version);

		var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
		this.wmsParams[projectionKey] = this._crs.code;

		TileLayer.prototype.onAdd.call(this, map);
	},

	getTileUrl: function (coords) {

		var tileBounds = this._tileCoordsToNwSe(coords),
		    crs = this._crs,
		    bounds = toBounds(crs.project(tileBounds[0]), crs.project(tileBounds[1])),
		    min = bounds.min,
		    max = bounds.max,
		    bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ?
		    [min.y, min.x, max.y, max.x] :
		    [min.x, min.y, max.x, max.y]).join(','),
		    url = TileLayer.prototype.getTileUrl.call(this, coords);
		return url +
			getParamString(this.wmsParams, url, this.options.uppercase) +
			(this.options.uppercase ? '&BBOX=' : '&bbox=') + bbox;
	},

	// @method setParams(params: Object, noRedraw?: Boolean): this
	// 使用新参数合并对象，并在当前屏幕上重新请求瓦片（除非设置了 `noRedraw` 为 `true`）。
	setParams: function (params, noRedraw) {

		extend(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}
});


// @factory L.tileLayer.wms(baseUrl: String, options: TileLayer.WMS options)
// 根据 WMS 服务的基础 URL 和 WMS 参数/选项对象，实例化一个 WMS 瓦片层对象。
export function tileLayerWMS(url, options) {
	return new TileLayerWMS(url, options);
}
