import { Ellipsoid, Frozen } from "@cesium/core";
import CesiumTerrainProvider from "./CesiumTerrainProvider.js";

/**
 * Creates a {@link CesiumTerrainProvider} instance for the {@link https://cesium.com/content/#cesium-world-terrain|Cesium World Terrain}.
 *
 * @function
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.requestVertexNormals=false] 指示客户端是否应在有可用时向服务器请求额外照明信息的标志。
 * @param {boolean} [options.requestWaterMask=false] 指示客户端是否应在有可用时向服务器请求瓦片级水掩模的标志。
 * @returns {Promise<CesiumTerrainProvider>} A 解析为创建的 CesiumTerrainProvider 的 promise。
 *
 * @see Ion
 *
 * @example
 * // 使用默认设置创建 Cesium World Terrain
 * try {
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: await Cesium.createWorldTerrainAsync();
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 *
 * @example
 * // 使用水和法线创建 Cesium World Terrain
 * try {
 * const viewer1 = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: await Cesium.createWorldTerrainAsync({
 * requestWaterMask: true,
 * requestVertexNormals: true
 *     });
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 *
 */
function createWorldTerrainAsync(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  return CesiumTerrainProvider.fromIonAssetId(1, {
    requestVertexNormals: options.requestVertexNormals ?? false,
    requestWaterMask: options.requestWaterMask ?? false,
    ellipsoid: Ellipsoid.WGS84,
  });
}
export default createWorldTerrainAsync;