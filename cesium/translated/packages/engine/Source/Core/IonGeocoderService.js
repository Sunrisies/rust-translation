import { Check, DeveloperError, Frozen, defined } from "@cesium/core";
import Credit from "./Credit.js";
import Ion from "./Ion.js";
import IonGeocodeProviderType from "./IonGeocodeProviderType.js";
import PeliasGeocoderService from "./PeliasGeocoderService.js";
import Resource from "./Resource.js";

/**
 * @param {*} geocodeProviderType
 * @throws {DeveloperError}
 * @private
 */
function validateIonGeocodeProviderType(geocodeProviderType) {
  if (
    !Object.values(IonGeocodeProviderType).some(
      (value) => value === geocodeProviderType,
    )
  ) {
    throw new DeveloperError(
      `Invalid geocodeProviderType: "${geocodeProviderType}"`,
    );
  }
}

const providerToParameterMap = Object.freeze({
  [IonGeocodeProviderType.GOOGLE]: "google",
  [IonGeocodeProviderType.BING]: "bing",
  [IonGeocodeProviderType.DEFAULT]: undefined,
});

function providerToQueryParameter(provider) {
  return providerToParameterMap[provider];
}

function queryParameterToProvider(parameter) {
  return Object.entries(providerToParameterMap).find(
    (entry) => entry[1] === parameter,
  )[0];
}

/**
 * 通过 Cesium ion 提供地理编码服务。
 * @alias IonGeocoderService
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Scene} options.scene 场景
 * @param {string} [options.accessToken=Ion.defaultAccessToken] 用于使用的访问令牌。
 * @param {string|Resource} [options.server=Ion.defaultServer] 指向 Cesium ion API 服务器的资源。
 * @param {IonGeocodeProviderType} [options.geocodeProviderType=IonGeocodeProviderType.DEFAULT] Cesium ion API 服务器应使用的地理编码器以完成此请求。
 *
 * @see Ion
 */
function IonGeocoderService(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.scene", options.scene);
  //>>includeEnd('debug');

  const geocodeProviderType =
    options.geocodeProviderType ?? IonGeocodeProviderType.DEFAULT;
  //>>includeStart('debug', pragmas.debug);
  validateIonGeocodeProviderType(geocodeProviderType);
  //>>includeEnd('debug');

  const accessToken = options.accessToken ?? Ion.defaultAccessToken;
  const server = Resource.createIfNeeded(options.server ?? Ion.defaultServer);
  server.appendForwardSlash();

  const defaultTokenCredit = Ion.getDefaultTokenCredit(accessToken);
  if (defined(defaultTokenCredit)) {
    options.scene.frameState.creditDisplay.addStaticCredit(
      Credit.clone(defaultTokenCredit),
    );
  }

  const searchEndpoint = server.getDerivedResource({
    url: "v1/geocode",
  });

  if (defined(accessToken)) {
    searchEndpoint.appendQueryParameters({ access_token: accessToken });
  }

  this._accessToken = accessToken;
  this._server = server;
  this._pelias = new PeliasGeocoderService(searchEndpoint);
  // geocoderProviderType isn't stored here directly but instead relies on the
  // query parameters of this._pelias.url.  Use the setter logic to update value.
  this.geocodeProviderType = geocodeProviderType;
}

Object.defineProperties(IonGeocoderService.prototype, {
  /**
   * 在执行地理编码后获取显示信用。通常用于向
   * 地理编码服务提供信用。
   * @memberof IonGeocoderService.prototype
   * @type {Credit|undefined}
   * @readonly
   */
  credit: {
    get: function () {
      return undefined;
    },
  },
  /**
   * Cesium ion API 服务器应使用的地理编码服务以处理地理编码请求。
   * @memberof IonGeocoderService.prototype
   * @type {IonGeocodeProviderType}
   * @default IonGeocodeProviderType.DEFAULT
   */
  geocodeProviderType: {
    get: function () {
      return queryParameterToProvider(
        this._pelias.url.queryParameters["geocoder"],
      );
    },
    set: function (geocodeProviderType) {
      validateIonGeocodeProviderType(geocodeProviderType);
      const query = {
        ...this._pelias.url.queryParameters,
        geocoder: providerToQueryParameter(geocodeProviderType),
      };
      // Delete the geocoder parameter to prevent sending &geocoder=undefined in the query
      if (!defined(query.geocoder)) {
        delete query.geocoder;
      }
      this._pelias.url.setQueryParameters(query);
    },
  },
});

/**
 * @function
 *
 * @param {string} query 要发送给地理编码服务的查询。
 * @param {GeocodeType} [type=GeocodeType.SEARCH] 要执行的地理编码类型。
 * @returns {Promise<GeocoderService.Result[]>}
 */
IonGeocoderService.prototype.geocode = async function (query, geocodeType) {
  return this._pelias.geocode(query, geocodeType);
};
export default IonGeocoderService;
