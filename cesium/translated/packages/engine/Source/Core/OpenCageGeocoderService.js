import { Cartesian3, Check, Rectangle, combine, defined } from "@cesium/core";
import Credit from "./Credit.js";
import Resource from "./Resource.js";

/**
 * 通过 {@link https://opencagedata.com/|OpenCage} 服务器提供地理编码服务。
 * @alias OpenCageGeocoderService
 * @constructor
 *
 * @param {Resource|string} url 指向 OpenCage 服务器的端点。
 * @param {string} apiKey OpenCage API 密钥。
 * @param {object} [params] 具有以下属性的对象（参见 https://opencagedata.com/api#forward-opt）：
 * @param {number} [params.abbrv] 设置为 1 时，会尝试缩写并缩短我们返回的格式化字符串。
 * @param {number} [options.add_request] 设置为 1 时，各种请求参数会被添加到响应中，便于调试。
 * @param {string} [options.bounds] 向地理编码器提供关于查询所在地区的提示信息。
 * @param {string} [options.countrycode] 将结果限制为指定的一个或多个国家（根据 ISO 3166-1 Alpha 2 标准定义）。
 * @param {string} [options.jsonp] 用函数名包裹返回的 JSON 数据。
 * @param {string} [options.language] IETF 格式语言代码。
 * @param {number} [options.limit] 我们应该返回的最大结果数量。
 * @param {number} [options.min_confidence] 1-10 之间的整数。仅返回具有至少此置信度的结果。
 * @param {number} [options.no_annotations] 设置为 1 时，结果将不包含注释。
 * @param {number} [options.no_dedupe] 设置为 1 时，结果将不会被去重。
 * @param {number} [options.no_record] 设置为 1 时，查询内容不会被记录。
 * @param {number} [options.pretty] 设置为 1 时，结果会以“美观”的形式打印，便于阅读，有助于调试。
 * @param {string} [options.proximity] 向地理编码器提供提示，以偏向靠近指定位置的结果（例如：41.40139,2.12870）。
 *
 * @example
 * // 配置 Viewer 使用 OpenCage 地理编码器
 * const viewer = new Cesium.Viewer('cesiumContainer', {
 * geocoder: new Cesium.OpenCageGeocoderService('https://api.opencagedata.com/geocode/v1/', '<API key>')
 * });
 */
function OpenCageGeocoderService(url, apiKey, params) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  Check.defined("apiKey", apiKey);
  if (defined(params)) {
    Check.typeOf.object("params", params);
  }
  //>>includeEnd('debug');

  url = Resource.createIfNeeded(url);
  url.appendForwardSlash();
  url.setQueryParameters({ key: apiKey });
  this._url = url;
  this._params = params ?? {};
  this._credit = new Credit(
    `Geodata copyright <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors`,
    false,
  );
}

Object.defineProperties(OpenCageGeocoderService.prototype, {
  /**
   * 用于访问 OpenCage 端点的资源。
   * @type {Resource}
   * @memberof OpenCageGeocoderService.prototype
   * @readonly
   */
  url: {
    get: function () {
      return this._url;
    },
  },
  /**
   * 传递给 OpenCage 的可选参数，以自定义地理编码功能。
   * @type {object}
   * @memberof OpenCageGeocoderService.prototype
   * @readonly
   */
  params: {
    get: function () {
      return this._params;
    },
  },
  /**
   * 在执行地理编码后获取显示信用。通常用于向
   * 地理编码服务提供信用。
   * @memberof OpenCageGeocoderService.prototype
   * @type {Credit|undefined}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },
});

/**
 * @function
 *
 * @param {string} query 要发送给地理编码服务的查询内容。
 * @returns {Promise<GeocoderService.Result[]>}
 */
OpenCageGeocoderService.prototype.geocode = async function (query) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("query", query);
  //>>includeEnd('debug');

  const resource = this._url.getDerivedResource({
    url: "json",
    queryParameters: combine(this._params, { q: query }),
  });
  return resource.fetchJson().then(function (response) {
    return response.results.map(function (resultObject) {
      let destination;
      const bounds = resultObject.bounds;

      if (defined(bounds)) {
        destination = Rectangle.fromDegrees(
          bounds.southwest.lng,
          bounds.southwest.lat,
          bounds.northeast.lng,
          bounds.northeast.lat,
        );
      } else {
        const { lng, lat } = resultObject.geometry;
        destination = Cartesian3.fromDegrees(lng, lat);
      }

      return {
        displayName: resultObject.formatted,
        destination: destination,
      };
    });
  });
};
export default OpenCageGeocoderService;
