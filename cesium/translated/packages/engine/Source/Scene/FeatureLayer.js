// @ts-check

import { Check } from "@cesium/core";

/**
 * @typedef {object} FeatureLayerOptions
 * @property {string} [name]
 * @private
 */

/**
 * 由源数据定义的特定特征集合。它既不渲染也不设置样式。
 * 这些特征。源格式对图层没有影响。目前，图层是由 3D Tiles 1.1 组或 GeoJSON 生成的。
 * 不要直接创建此类图层。应通过
 * <p>
 * {@link Cesium3DTileset#featureLayers} 或 {@link FeatureLayerProvider} 来访问图层，例如
 * {@link Cesium3DTileset#featureLayers} or a {@link FeatureLayerProvider}, such as
 * {@link GeoJsonFeatureLayerProvider#featureLayers}.
 * </p>
 *
 * @internalConstructor
 *
 * @experimental This 该特征不是最终定稿，且可能根据 Cesium 的标准弃用政策发生变化。
 */
class FeatureLayer {
  /**
   * @privateParam {object} options 具有以下属性的对象：
   * @privateParam {string} [options.name] 图层名称。
   */
  constructor(/** @type {FeatureLayerOptions} */ options) {
    this._name = options.name;
    this._show = true;
  }

  /**
   * 图层是否显示。在 {@link Cesium3DTileset} 中，隐藏的图层不会被请求或渲染。包含多内容的 tiles 不受影响。
   * 在 {@link MVTDataProvider} 中，每个 tiles 都包含所有图层，因此 tiles 仍然会被请求，只有隐藏层的特征不会渲染。
   * In an {@link MVTDataProvider}, each tile holds every layer, so tiles are still
   * requested and only the hidden layer's features are not rendered.
   *
   * @type {boolean}
   * @default true
   */
  get show() {
    return this._show;
  }

  set show(value) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.bool("value", value);
    //>>includeEnd('debug');
    this._show = value;
  }

  /**
   * The layer name. For a 3D Tiles group, defaults to its property with the
   * <code>NAME</code> semantic, then its <code>name</code> property, otherwise
   * <code>undefined</code>.
   *
   * @type {string|undefined}
   */
  get name() {
    return this._name;
  }

  set name(value) {
    this._name = value;
  }
}

export default FeatureLayer;