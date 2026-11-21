import Credit from "./Credit.js";
import Resource from "./Resource.js";

/**
 * 访问 Google 地图 API 的默认设置。
 * <br/>
 * 如果您直接使用任何 Google 地图 API，例如通过 {@link createGooglePhotorealistic3DTileset}，则只需要 API 密钥。
 * 请遵循 {@link https://developers.google.com/maps/documentation/embed/get-api-key} 中的指南来管理 Google 地图平台的 API 密钥。
 * <br/>
 * 您可以在一个 API 密钥上启用多个 Google 地图平台 API。
 * 不过，如果您希望为 Street View Static API 使用专用密钥，则可以使用单独的 {@link GoogleMaps.defaultStreetViewStaticApiKey}。
 * 获取或设置默认的 Google 地图 API 密钥。
 *
 * @see createGooglePhotorealistic3DTileset
 * @see https://developers.google.com/maps/documentation/embed/get-api-key
 *
 * @namespace GoogleMaps
 */
const GoogleMaps = {};

/**
 * 获取或设置默认的 Google 地图 Tiles API 端点。
 *
 * @type {undefined|string}
 */
GoogleMaps.defaultApiKey = undefined;

/**
 * 获取或设置默认的 Google 地图 Tiles API 端点。
 *
 * @type {string|Resource}
 * @default https://tile.googleapis.com/
 */
GoogleMaps.mapTilesApiEndpoint = new Resource({
  url: "https://tile.googleapis.com/",
});

/**
 * 获取或设置默认的 Google 地图 Street View Static API 密钥。
 *
 * @type {undefined|string}
 */
GoogleMaps.defaultStreetViewStaticApiKey = undefined;

/**
 * 获取或设置默认的 Google Street View Static API 端点。
 *
 * @type {string|Resource}
 * @default https://maps.googleapis.com/maps/api/streetview
 */
GoogleMaps.streetViewStaticApiEndpoint = new Resource({
  url: "https://maps.googleapis.com/maps/api/streetview",
});

GoogleMaps.getDefaultCredit = function () {
  return new Credit(
    `<img alt=\"Google\" src=\"https://assets.ion.cesium.com/google-credit.png\" style=\"vertical-align:-6px\">`,
    true,
  );
};
export default GoogleMaps;
