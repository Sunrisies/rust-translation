import { Frozen } from "@cesium/core";
import IonImageryProvider from "./IonImageryProvider.js";
import IonWorldImageryStyle from "./IonWorldImageryStyle.js";

/**
 * 创建了一个 {@link IonImageryProvider} 实例，用于 ion 默认的全球基础影像图层，当前为 Bing 地图。
 *
 * @function
 *
 * @param {object} [options] 该对象包含以下属性：
 * @param {IonWorldImageryStyle} [options.style=IonWorldImageryStyle] 基础影像的样式，目前仅支持 AERIAL、AERIAL_WITH_LABELS 和 ROAD 三种模式。
 * @returns {Promise<IonImageryProvider>}
 *
 * @see Ion
 *
 * @example
 * // 使用默认设置创建 Cesium World Imagery 基础图层
 * try {
 * const imageryProvider = await Cesium.createWorldImageryAsync();
 * } catch (error) {
 * console.log(`创建世界影像时出错：${error}`);
 * }
 *
 * @example
 * // 使用不同样式创建 Cesium World Imagery
 * try {
 * const imageryProvider = await Cesium.createWorldImageryAsync({
 * style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS
 *   });
 * } catch (error) {
 * console.log(`创建世界影像时出错：${error}`);
 * }
 */
function createWorldImageryAsync(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const style = options.style ?? IonWorldImageryStyle.AERIAL;
  return IonImageryProvider.fromAssetId(style);
}
export default createWorldImageryAsync;
