import { Frozen } from "@cesium/core";
import CesiumTerrainProvider from "./CesiumTerrainProvider.js";

/**
 * 为 {@link CesiumWorldBathymetry} 创建 {@link CesiumTerrainProvider} 实例。
 *
 * @function
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.requestVertexNormals=false] 指示客户端是否应请求服务器提供的额外照明信息的标志。
 * @returns {Promise<CesiumTerrainProvider>} A 解析后得到的 CesiumTerrainProvider 对象。
 *
 * @see Ion
 *
 * @example
 * // 使用默认设置创建 CesiumWorldBathymetry
 * try {
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: await Cesium.createWorldBathymetryAsync();
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 *
 * @example
 * // 使用法线信息创建 CesiumWorldBathymetry
 * try {
 * const viewer1 = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: await Cesium.createWorldBathymetryAsync({
 * requestVertexNormals: true
 *     });
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 *
 */
function createWorldBathymetryAsync(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  return CesiumTerrainProvider.fromIonAssetId(2426648, {
    requestVertexNormals: options.requestVertexNormals ?? false,
  });
}
export default createWorldBathymetryAsync;
