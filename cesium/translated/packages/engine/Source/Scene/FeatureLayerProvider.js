// @ts-check

import { DeveloperError } from "@cesium/core";
/** @import FeatureLayerCollection from "./FeatureLayerCollection.js"; */

/**
 * 从数据源提供 {@link FeatureLayer} 对象。
 * <p>
 * 包含用于样式设置和特征绘制的成员，例如将通知作为特征显示。
 * 加载与卸载功能将随向量样式 API 的推出而添加。
 * </p>
 *
 * @interface
 *
 * @see GeoJsonFeatureLayerProvider
 *
 * @experimental This 该特性并非最终定局，且可能根据 Cesium 的标准弃用政策进行变更。
 */
class FeatureLayerProvider {
  constructor() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 此实例提供的影像图层。
   *
   * @type {FeatureLayerCollection}
   * @readonly
   * @constant
   */
  get featureLayers() {
    return DeveloperError.throwInstantiationError();
  }
}

export default FeatureLayerProvider;
