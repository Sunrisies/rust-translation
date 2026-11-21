import { Cartesian3, Check, Rectangle, defined } from "@cesium/core";
import GeocodeType from "./GeocodeType.js";
import Resource from "./Resource.js";

/**
 * 通过 {@link https://pelias.io/|Pelias} 服务器提供地理编码服务。
 * @alias PeliasGeocoderService
 * @constructor
 *
 * @param {Resource|string} url 通往 Pelias 服务器的端点。
 *
 * @example
 * // 配置 Viewer 使用由 https://geocode.earth/ 提供的 Pelias 服务器。
 * const viewer = new Cesium.Viewer('cesiumContainer', {
 * geocoder: new Cesium.PeliasGeocoderService(new Cesium.Resource({
 * url: 'https://api.geocode.earth/v1/',
 * queryParameters: {
 * api_key: '<Your geocode.earth API key>'
 *     }
 *   }))
 * });
 */
function PeliasGeocoderService(url) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  this._url = Resource.createIfNeeded(url);
  this._url.appendForwardSlash();
}

Object.defineProperties(PeliasGeocoderService.prototype, {
  /**
   * 用于访问 Pelias 端点的 Resource。
   * @type {Resource}
   * @memberof PeliasGeocoderService.prototype
   * @readonly
   */
  url: {
    get: function () {
      return this._url;
    },
  },
  /**
   * 在执行地理编码后获取显示信用。通常用于向
   * 地理编码服务提供信用。
   * @memberof PeliasGeocoderService.prototype
   * @type {Credit|undefined}
   * @readonly
   */
  credit: {
    get: function () {
      return undefined;
    },
  },
});

/**
 * @function
 *
 * @param {string} query 要发送给地理编码服务的查询参数。
 * @param {GeocodeType} [type=GeocodeType.SEARCH] 要执行的地理编码类型。
 * @returns {Promise<GeocoderService.Result[]>}
 */
PeliasGeocoderService.prototype.geocode = async function (query, type) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("query", query);
  //>>includeEnd('debug');

  const resource = this._url.getDerivedResource({
    url: type === GeocodeType.AUTOCOMPLETE ? "autocomplete" : "search",
    queryParameters: {
      text: query,
    },
  });

  return resource.fetchJson().then(function (results) {
    return results.features.map(function (resultObject) {
      let destination;
      const bboxDegrees = resultObject.bbox;

      if (defined(bboxDegrees)) {
        destination = Rectangle.fromDegrees(
          bboxDegrees[0],
          bboxDegrees[1],
          bboxDegrees[2],
          bboxDegrees[3],
        );
      } else {
        const lon = resultObject.geometry.coordinates[0];
        const lat = resultObject.geometry.coordinates[1];
        destination = Cartesian3.fromDegrees(lon, lat);
      }

      return {
        displayName: resultObject.properties.label,
        destination: destination,
        attributions: results.attributions,
      };
    });
  });
};
export default PeliasGeocoderService;
