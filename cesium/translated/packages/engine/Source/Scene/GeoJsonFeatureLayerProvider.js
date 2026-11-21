// @ts-check

import { Check, RuntimeError, defined } from "@cesium/core";
import Resource from "../Core/Resource.js";
import FeatureLayer from "./FeatureLayer.js";
import FeatureLayerCollection from "./FeatureLayerCollection.js";
/** @import FeatureLayerProvider from "./FeatureLayerProvider.js"; */

/**
 * @typedef {object} GeoJsonFeatureLayerProviderOptions
 * @property {string} [name]
 * @private
 */

/**
 * A {@link FeatureLayerProvider} for a GeoJSON object. Provides one
 * {@link FeatureLayer} containing all of its features.
 * <p>
 * Do not construct this directly. Use {@link GeoJsonFeatureLayerProvider.fromGeoJson}
 * or {@link GeoJsonFeatureLayerProvider.fromUrl}.
 * </p>
 *
 * @implements {FeatureLayerProvider}
 *
 * @example
 * const provider = await Cesium.GeoJsonFeatureLayerProvider.fromUrl(
 * "roads.geojson",
 * { name: "Roads" },
 * );
 * provider.featureLayers.get(0).show = false;
 *
 * @internalConstructor
 *
 * @experimental This 该特征并非最终定局，且可能根据 Cesium 的标准弃用政策发生变化。
 */
class GeoJsonFeatureLayerProvider {
  /**
   * @privateParam {object} geoJson 一个 GeoJSON 对象。
   * @privateParam {object} [options] 一个具有以下属性的对象：
   * @privateParam {string} [options.name] 图层名称。
   */
  constructor(
    /** @type {object} */ geoJson,
    /** @type {GeoJsonFeatureLayerProviderOptions|undefined} */ options,
  ) {
    this._geoJson = geoJson;
    this._featureLayers = new FeatureLayerCollection();
    this._featureLayers._add(new FeatureLayer({ name: options?.name }));
  }

  /**
   * 此实例提供的所有特征图层。一个 GeoJSON 文档相当于一个
   * 图层，因此始终恰好包含一个图层。
   *
   * @type {FeatureLayerCollection}
   * @readonly
   */
  get featureLayers() {
    return this._featureLayers;
  }

  /**
   * 为 GeoJSON 对象的特征创建提供者。
   *
   * @param {object} geoJson 一个 GeoJSON 对象。
   * @param {object} [options] 一个具有以下属性的对象：
   * @param {string} [options.name] 图层名称。
   * @returns {GeoJsonFeatureLayerProvider} The 提供者。
   */
  static fromGeoJson(geoJson, options) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("geoJson", geoJson);
    //>>includeEnd('debug');

    return new GeoJsonFeatureLayerProvider(geoJson, options);
  }

  /**
   * 获取 GeoJSON 文件并为其特征创建提供者。
   *
   * @param {Resource|string} url GeoJSON 文件的 URL。
   * @param {object} [options] 一个具有以下属性的对象：
   * @param {string} [options.name] 图层名称。
   * @returns {Promise<GeoJsonFeatureLayerProvider>} A 解析为提供者的 promise。
   *
   * @exception {RuntimeError} Failed 用于加载 GeoJSON。
   */
  static async fromUrl(url, options) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("url", url);
    //>>includeEnd('debug');

    const resource = Resource.createIfNeeded(url);
    const geoJson = await resource.fetchJson();
    if (!defined(geoJson)) {
      throw new RuntimeError(
        `Failed to load GeoJSON from ${resource.getUrlComponent(true)}.`,
      );
    }
    return GeoJsonFeatureLayerProvider.fromGeoJson(geoJson, options);
  }
}

export default GeoJsonFeatureLayerProvider;