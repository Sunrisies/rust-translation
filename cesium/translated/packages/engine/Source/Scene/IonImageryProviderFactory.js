import IonResource from "../Core/IonResource.js";
import ArcGisMapServerImageryProvider from "./ArcGisMapServerImageryProvider.js";
import BingMapsImageryProvider from "./BingMapsImageryProvider.js";
import TileMapServiceImageryProvider from "./TileMapServiceImageryProvider.js";
import GoogleEarthEnterpriseMapsProvider from "./GoogleEarthEnterpriseMapsProvider.js";
import MapboxImageryProvider from "./MapboxImageryProvider.js";
import SingleTileImageryProvider from "./SingleTileImageryProvider.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";
import WebMapServiceImageryProvider from "./WebMapServiceImageryProvider.js";
import WebMapTileServiceImageryProvider from "./WebMapTileServiceImageryProvider.js";
import Google2DImageryProvider from "./Google2DImageryProvider.js";
import Azure2DImageryProvider from "./Azure2DImageryProvider.js";

/**
 * 一个异步回调函数，用于从
 * Cesium 离子资产端点创建影像提供者。
 * @template {ImageryProvider} T
 * @callback IonImageryProviderFactoryCallback
 * @param {string} url 影像服务地址。
 * @param {object} endpoint Cesium 离子资产端点服务的结果。
 * @param {Resource} endpointResource 用于获取端点的原始资源。
 * @returns {Promise<T>} A 一个 resolves 为影像提供者实例的 Promise。
 * @private
 */

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<TileMapServiceImageryProvider>}
 */
export const defaultFactoryCallback = async (url, endpoint, endpointResource) =>
  TileMapServiceImageryProvider.fromUrl(
    new IonResource(endpoint, endpointResource),
  );

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<ArcGisMapServerImageryProvider>}
 */
export const ARCGIS_MAPSERVER = async (url, { options }) =>
  ArcGisMapServerImageryProvider.fromUrl(url, options);

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<BingMapsImageryProvider>}
 */
export const BING = async (url, { options }) => {
  return BingMapsImageryProvider.fromUrl(url, options);
};

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<GoogleEarthEnterpriseMapsProvider>}
 */
export const GOOGLE_EARTH = async (url, { options }) => {
  const channel = options.channel;
  delete options.channel;
  return GoogleEarthEnterpriseMapsProvider.fromUrl(url, channel, options);
};

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<MapboxImageryProvider>}
 */
export const MAPBOX = async (url, { options }) => {
  return new MapboxImageryProvider({
    url: url,
    ...options,
  });
};

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<SingleTileImageryProvider>}
 */
export const SINGLE_TILE = async (url, { options }) =>
  SingleTileImageryProvider.fromUrl(url, options);

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<TileMapServiceImageryProvider>}
 */
export const TMS = async (url, { options }) =>
  TileMapServiceImageryProvider.fromUrl(url, options);

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<UrlTemplateImageryProvider>}
 */
export const URL_TEMPLATE = async (url, { options }) => {
  return new UrlTemplateImageryProvider({
    url: url,
    ...options,
  });
};

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<WebMapServiceImageryProvider>}
 */
export const WMS = async (url, { options }) => {
  return new WebMapServiceImageryProvider({
    url: url,
    ...options,
  });
};

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<WebMapTileServiceImageryProvider>}
 */
export const WMTS = async (url, { options }) => {
  return new WebMapTileServiceImageryProvider({
    url: url,
    ...options,
  });
};

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<Google2DImageryProvider>}
 */
export const GOOGLE_2D_MAPS = async (url, endpoint, endpointResource) => {
  delete endpoint.externalType;
  endpoint.url = url;

  const ionResource = new IonResource(endpoint, endpointResource);

  const callback = (ionRoot, endpoint) => {
    delete endpoint.externalType;
    endpoint.url = url;

    const { options } = endpoint;
    ionRoot.setQueryParameters({
      session: options.session,
      key: options.key,
    });
  };

  ionResource.refreshCallback = callback;
  return new Google2DImageryProvider({
    ...endpoint.options,
    url: ionResource,
  });
};

/**
 * @private
 * @type {IonImageryProviderFactoryCallback<Azure2DImageryProvider>}
 */
export const AZURE_MAPS = async (url, endpoint, endpointResource) => {
  delete endpoint.externalType;
  endpoint.url = url;

  const ionResource = new IonResource(endpoint, endpointResource);

  const callback = (ionRoot, endpoint) => {
    delete endpoint.externalType;
    endpoint.url = url;

    const { options } = endpoint;
    ionRoot.setQueryParameters({
      "subscription-key": options["subscription-key"],
    });
  };

  ionResource.refreshCallback = callback;
  return new Azure2DImageryProvider({
    ...endpoint.options,
    url: ionResource,
  });
};

/**
 * 将 Cesium 离子返回的支持的外部影像资产类型与
 * 对应的影像提供者构造函数进行映射。
 * @private
 * @type {Object<string, IonImageryProviderFactoryCallback>}
 */
const IonImageryProviderFactory = {
  ARCGIS_MAPSERVER,
  BING,
  GOOGLE_EARTH,
  MAPBOX,
  SINGLE_TILE,
  TMS,
  URL_TEMPLATE,
  WMS,
  WMTS,
  GOOGLE_2D_MAPS,
  AZURE_MAPS,
  defaultFactoryCallback,
};

export default Object.freeze(IonImageryProviderFactory);
