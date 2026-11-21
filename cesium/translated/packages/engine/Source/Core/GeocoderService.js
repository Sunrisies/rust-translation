import { DeveloperError, defined } from "@cesium/core";
import Credit from "./Credit.js";

/**
 * @typedef {object} GeocoderService.Result
 * @property {string} displayName 位置的显示名称
 * @property {Rectangle|Cartesian3} destination 位置的范围框
 * @property {object[]} [attributions]
 */

/**
 * 通过外部服务提供地理编码功能。此类型描述了一个接口，
 * 但不适用于实际使用。
 * @alias GeocoderService
 * @constructor
 *
 * @see BingMapsGeocoderService
 * @see PeliasGeocoderService
 * @see OpenCageGeocoderService
 */
function GeocoderService() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(GeocoderService.prototype, {
  /**
   * 在执行地理编码后获取显示权限。通常用于授予
   * 地理编码服务使用权限。
   * @memberof GeocoderService.prototype
   * @type {Credit|undefined}
   * @readonly
   */
  credit: {
    get: DeveloperError.throwInstantiationError,
  },
});

/**
 * 如果存在，则解析地理编码结果中的权限信息。
 * @param {GeocoderService.Result} geocoderResult 地理编码结果
 * @returns {Credit[]|undefined} A 如果结果中存在，则列出权限；否则为未定义。
 */
GeocoderService.getCreditsFromResult = function (geocoderResult) {
  if (defined(geocoderResult.attributions)) {
    return geocoderResult.attributions.map(Credit.getIonCredit);
  }

  return undefined;
};

/**
 * @function
 *
 * @param {string} query 要发送给地理编码服务的查询语句
 * @param {GeocodeType} [type=GeocodeType.SEARCH] 要执行的地理编码类型。
 * @returns {Promise<GeocoderService.Result[]>}
 */
GeocoderService.prototype.geocode = DeveloperError.throwInstantiationError;
export default GeocoderService;
