import {
  Check,
  DeveloperError,
  Frozen,
  Rectangle,
  RuntimeError,
  defined,
} from "@cesium/core";
import Credit from "./Credit.js";
import Resource from "./Resource.js";

const API_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const CREDIT_HTML = `<img alt="Google" src="https://assets.ion.cesium.com/google-credit.png" style="vertical-align:-5px">`;

/**
 * 通过 Google 提供地理编码服务。
 *
 * @see {@link https://developers.google.com/maps/documentation/geocoding/policies|Google Geocoding Policies}
 * @alias GoogleGeocoderService
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.key 用于与 Google 地理编码服务使用的 API 密钥。
 */
function GoogleGeocoderService(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const key = options.key;
  //>>includeStart('debug', pragmas.debug);
  if (!defined(key)) {
    throw new DeveloperError("options.key is required.");
  }
  //>>includeEnd('debug');

  this._resource = new Resource({
    url: API_URL,
    queryParameters: { key },
  });

  this._credit = new Credit(CREDIT_HTML, true);
}

Object.defineProperties(GoogleGeocoderService.prototype, {
  /**
   * 在执行地理编码后获取显示信用值。通常用于向地理编码服务授予信用。
   * 地理编码服务。
   * @memberof GoogleGeocoderService.prototype
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
 * 获取与搜索字符串匹配的可能位置列表。
 *
 * @function
 *
 * @param {string} query 要发送给地理编码服务的查询内容。
 * @returns {Promise<GeocoderService.Result[]>}
 * @throws {RuntimeError} If 该服务返回的状态不是 <code>OK</code> 或 <code>ZERO_RESULTS</code>。
 */
GoogleGeocoderService.prototype.geocode = async function (query) {
  // See API documentation at https://developers.google.com/maps/documentation/geocoding/requests-geocoding

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("query", query);
  //>>includeEnd('debug');

  const resource = this._resource.getDerivedResource({
    queryParameters: {
      address: query,
    },
  });

  const response = await resource.fetchJson();

  if (response.status === "ZERO_RESULTS") {
    return [];
  }

  if (response.status !== "OK") {
    throw new RuntimeError(
      `GoogleGeocoderService got a bad response ${response.status}: ${response.error_message}`,
    );
  }

  const results = response.results.map((result) => {
    const southWest = result.geometry.viewport.southwest;
    const northEast = result.geometry.viewport.northeast;
    return {
      displayName: result.formatted_address,
      destination: Rectangle.fromDegrees(
        southWest.lng,
        southWest.lat,
        northEast.lng,
        northEast.lat,
      ),
      attribution: {
        html: CREDIT_HTML,
        collapsible: false,
      },
    };
  });

  return results;
};

export default GoogleGeocoderService;
