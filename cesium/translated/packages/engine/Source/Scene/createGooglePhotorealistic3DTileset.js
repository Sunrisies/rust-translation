import { Check, Frozen, defined, oneTimeWarning } from "@cesium/core";
import Cesium3DTileset from "./Cesium3DTileset.js";
import IonResource from "../Core/IonResource.js";
import GoogleMaps from "../Core/GoogleMaps.js";
import Resource from "../Core/Resource.js";

/**
 * 为 Google Photorealistic 3D 创建 {@link Cesium3DTileset} 实例。
 * tileset 表示瓦片集。
 *
 * Google Photorealistic 3D Tiles 只能与 Google geocoder 一起使用。要
 * 确认您了解此限制，请通过
 * 在 apiOptions 中设置 `usingOnlyWithGoogleGeocoder: true`。否则，调用此函数时会显示一次警告。
 * 您的 API 密钥用于访问 Google Photorealistic 3D Tiles。有关如何生成自己密钥的说明，请参阅 {@link https://developers.google.com/maps/documentation/javascript/get-api-key}。
 *
 * @function
 *
 * @param {object} [apiOptions]
 * @param {string} [apiOptions.key=GoogleMaps.defaultApiKey] 确认此瓦片集只能与 Google geocoder 一起使用。
 * @param {true} [apiOptions.onlyUsingWithGoogleGeocoder] 描述初始化选项的对象。
 * @param {Cesium3DTileset.ConstructorOptions} [tilesetOptions] const viewer = new Cesium.Viewer("cesiumContainer", {
 * @returns {Promise<Cesium3DTileset>}
 *
 * @see GoogleMaps
 *
 * @example
 * geocoder: Cesium.IonGeocodeProviderType.GOOGLE
 * try {
 * });
 *
 * const tileset = await Cesium.createGooglePhotorealistic3DTileset({
 * onlyUsingWithGoogleGeocoder: true,
 * viewer.scene.primitives.add(tileset));
 *   });
 * } catch (error) {
 * console.log(`创建瓦片集时出错：${error}`);
 * // 使用您自己的 Google Maps API 密钥
 * }
 *
 * @example
 * Cesium.GoogleMaps.defaultApiKey = "your-api-key";
 * const viewer = new Cesium.Viewer("cesiumContainer". {
 *
 * geocoder: Cesium.IonGeocodeProviderType.GOOGLE
 * try {
 * });
 *
 * const tileset = await Cesium.createGooglePhotorealistic3DTileset({
 * onlyUsingWithGoogleGeocoder: true,
 * viewer.scene.primitives.add(tileset));
 *   });
 * } catch (error) {
 * console.log(`创建瓦片集时出错：${error}`);
 * console.log(`Error creating tileset: ${error}`);
 * }
 */
async function createGooglePhotorealistic3DTileset(apiOptions, tilesetOptions) {
  tilesetOptions = tilesetOptions ?? {};
  tilesetOptions.cacheBytes = tilesetOptions.cacheBytes ?? 1536 * 1024 * 1024;
  tilesetOptions.maximumCacheOverflowBytes =
    tilesetOptions.maximumCacheOverflowBytes ?? 1024 * 1024 * 1024;
  tilesetOptions.enableCollision = tilesetOptions.enableCollision ?? true;

  apiOptions = apiOptions ?? Frozen.EMPTY_OBJECT;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("apiOptions", apiOptions);
  //>>includeEnd('debug');

  if (!apiOptions.onlyUsingWithGoogleGeocoder) {
    oneTimeWarning(
      "google-tiles-with-google-geocoder",
      "Only the Google geocoder can be used with Google Photorealistic 3D Tiles.  Set the `geocode` property of Viewer constructor options.  You can set additionalOptions.onlyUsingWithGoogleGeocoder to hide this warning once you have configured the geocoder.",
    );
  }

  const key = apiOptions.key ?? GoogleMaps.defaultApiKey;
  if (!defined(key)) {
    return requestCachedIonTileset(tilesetOptions);
  }

  let credits;
  const credit = GoogleMaps.getDefaultCredit();
  if (defined(credit)) {
    credits = [credit];
  }

  const resource = new Resource({
    url: `${GoogleMaps.mapTilesApiEndpoint}v1/3dtiles/root.json`,
    queryParameters: {
      key: key,
    },
    credits: credits,
  });

  return Cesium3DTileset.fromUrl(resource, tilesetOptions);
}

const metadataCache = {};
async function requestCachedIonTileset(options) {
  const ionAssetId = 2275207;
  const cacheKey = ionAssetId;

  let promise = metadataCache[cacheKey];
  if (!defined(promise)) {
    promise = IonResource.fromAssetId(ionAssetId);
    metadataCache[cacheKey] = promise;
  }

  const resource = await promise;
  return Cesium3DTileset.fromUrl(resource, options);
}

export default createGooglePhotorealistic3DTileset;
